import chalk from 'chalk';

export function success(msg: string) { console.log(chalk.green('\u2713'), msg); }
export function error(msg: string) { console.error(chalk.red('\u2717'), msg); }
export function warn(msg: string) { console.log(chalk.yellow('!'), msg); }
export function info(msg: string) { console.log(chalk.blue('\u2139'), msg); }

/** Prompt for password (masked input) using node:readline */
export async function promptPassword(message: string): Promise<string> {
  const readline = await import('node:readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    process.stdout.write(message);
    let input = '';
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (ch: string) => {
      if (ch === '\n' || ch === '\r') {
        stdin.removeListener('data', onData);
        if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
        process.stdout.write('\n');
        rl.close();
        resolve(input);
      } else if (ch === '\u0003') { // Ctrl+C
        process.exit(0);
      } else if (ch === '\u007f' || ch === '\b') { // Backspace
        input = input.slice(0, -1);
        process.stdout.write('\r' + message + '*'.repeat(input.length) + ' \b');
      } else {
        input += ch;
        process.stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });
}

/** Prompt for confirmation */
export async function promptConfirm(message: string): Promise<boolean> {
  const readline = await import('node:readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}
