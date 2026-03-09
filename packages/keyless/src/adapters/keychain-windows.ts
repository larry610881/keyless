import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { KeychainAdapter } from '../types.js';

const execFileAsync = promisify(execFile);
const TARGET_PREFIX = 'keyless:';

export class WindowsKeychainAdapter implements KeychainAdapter {
  readonly name = 'windows-credential-manager';

  async isAvailable(): Promise<boolean> {
    if (process.platform !== 'win32') return false;
    try {
      await execFileAsync('powershell', ['-Command', 'Get-Command cmdkey']);
      return true;
    } catch {
      return false;
    }
  }

  async getSecret(keyId: string): Promise<string | null> {
    try {
      // Use PowerShell to read from Windows Credential Manager
      const script = `
        $cred = Get-StoredCredential -Target '${TARGET_PREFIX}${keyId}' -ErrorAction SilentlyContinue
        if ($cred) { $cred.GetNetworkCredential().Password } else { $null }
      `.trim();

      // Fallback: use cmdkey to check existence, then read via .NET
      const readScript = `
        Add-Type -AssemblyName System.Runtime.InteropServices
        $target = '${TARGET_PREFIX}${keyId}'
        $query = cmdkey /list:$target 2>&1
        if ($query -match 'none') { exit 1 }
        [System.Text.Encoding]::UTF8.GetString(
          [System.Convert]::FromBase64String(
            (cmdkey /list:$target | Select-String 'Password').ToString().Split(':',2)[1].Trim()
          )
        )
      `.trim();

      // Simple approach: store as generic credential via PowerShell
      const { stdout } = await execFileAsync('powershell', [
        '-NoProfile', '-NonInteractive', '-Command',
        `$bytes = [System.IO.File]::ReadAllBytes("$env:LOCALAPPDATA\\keyless\\${keyId}.bin"); [System.Text.Encoding]::UTF8.GetString([System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, 'CurrentUser'))`,
      ]);
      return stdout.trimEnd() || null;
    } catch {
      return null;
    }
  }

  async setSecret(keyId: string, value: string): Promise<void> {
    // Use DPAPI via PowerShell to encrypt and store
    const script = `
      $dir = "$env:LOCALAPPDATA\\keyless"
      if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
      Add-Type -AssemblyName System.Security
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('${value.replace(/'/g, "''")}')
      $encrypted = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, 'CurrentUser')
      [System.IO.File]::WriteAllBytes("$dir\\${keyId}.bin", $encrypted)
    `.trim();

    await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script]);
  }

  async deleteSecret(keyId: string): Promise<boolean> {
    try {
      await execFileAsync('powershell', [
        '-NoProfile', '-NonInteractive', '-Command',
        `Remove-Item "$env:LOCALAPPDATA\\keyless\\${keyId}.bin" -ErrorAction Stop`,
      ]);
      return true;
    } catch {
      return false;
    }
  }
}
