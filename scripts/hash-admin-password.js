// Generates a bcrypt hash for the admin password, for the ADMIN_PASSWORD_HASH
// Railway variable. Reads the password from a hidden terminal prompt so it
// is never written to disk, shell history, or process listings.
// Usage: npm run admin:hash-password
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;
const KEY_ENTER = ['\n', '\r'];
const KEY_EOF = String.fromCharCode(4); // Ctrl-D
const KEY_INTERRUPT = String.fromCharCode(3); // Ctrl-C
const KEY_BACKSPACE = [String.fromCharCode(127), '\b']; // Backspace / Ctrl-H

function readPasswordHidden(promptText) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    if (!stdin.isTTY) {
      reject(new Error('This script needs an interactive terminal to hide input. Run it directly (not piped).'));
      return;
    }

    stdout.write(promptText);

    let password = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (char) => {
      char = char.toString();

      if (KEY_ENTER.includes(char) || char === KEY_EOF) {
        stdin.removeListener('data', onData);
        stdin.setRawMode(false);
        stdin.pause();
        stdout.write('\n');
        resolve(password);
        return;
      }

      if (char === KEY_INTERRUPT) {
        stdout.write('\n');
        process.exit(1);
        return;
      }

      if (KEY_BACKSPACE.includes(char)) {
        password = password.slice(0, -1);
        return;
      }

      password += char;
    };

    stdin.on('data', onData);
  });
}

async function main() {
  const password = await readPasswordHidden('Enter admin password (input hidden): ');
  if (!password) {
    console.error('No password entered. Aborting.');
    process.exitCode = 1;
    return;
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  console.log('\nSet this as ADMIN_PASSWORD_HASH in Railway (do not commit it):\n');
  console.log(hash);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
