// Generate (or check) the bcrypt hash for the /insider admin login.
//
//   npm run hash-password            -> asks for a password, prints ADMIN_PASSWORD
//   npm run hash-password -- --check -> asks for a password, checks it against
//                                       ADMIN_PASSWORD from .env / the environment
//
// The password is typed at a prompt rather than passed on the command line,
// so characters like $ ! ` " are never rewritten by the shell (a password with
// "$" passed through `node -e "...hashSync('pa$$', 12)"` produces a hash of a
// different string, and the real password then never matches).
import './env.mjs';
import bcrypt from 'bcryptjs';
import { configProblem } from './auth.mjs';

function ask(question) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    if (!stdin.isTTY) {
      let buf = '';
      stdin.setEncoding('utf8');
      stdin.on('data', (c) => { buf += c; });
      stdin.on('end', () => resolve(buf.replace(/\r?\n$/, '')));
      return;
    }
    // Hidden input: don't echo the password to the terminal.
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (ch) => {
      if (ch === '\r' || ch === '\n' || ch === '\u0004') {
        stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData);
        stdout.write('\n'); resolve(value);
      } else if (ch === '\u0003') {
        stdout.write('\n'); process.exit(130);
      } else if (ch === '\u007f' || ch === '\b') {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

const check = process.argv.includes('--check');
const password = await ask(check ? 'Password to check: ' : 'New admin password: ');
if (!password) { console.error('No password entered.'); process.exit(1); }

if (check) {
  const problem = configProblem();
  if (problem) { console.error('Problem with the server settings: ' + problem); process.exit(1); }
  const hash = String(process.env.ADMIN_PASSWORD).trim().replace(/^["']|["']$/g, '').replace(/\\\$/g, '$');
  const ok = await bcrypt.compare(password, hash);
  console.log(ok ? 'MATCH: this password works with ADMIN_PASSWORD.' : 'NO MATCH: this password does not match ADMIN_PASSWORD.');
  process.exit(ok ? 0 : 1);
}

if (password.length < 10) console.warn('Warning: use at least 10 characters for the admin password.');
const hash = await bcrypt.hash(password, 12);
console.log('\nSet this as ADMIN_PASSWORD (copy the value only, no quotes, no spaces):\n');
console.log(hash);
console.log('\nIt is ' + hash.length + ' characters long. Vercel should show exactly 60 characters.');
