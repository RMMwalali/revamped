import { login } from './auth.mjs';
const s = await login('super@stillcraftevents.co.ke', '$tillKr@ft13');
if (s) {
  console.log('LOGIN OK — token', s.token.slice(0, 8) + '…', 'expires', s.expires.toISOString());
  await poolEnd();
  process.exit(0);
}
console.log('LOGIN FAILED');
process.exit(1);