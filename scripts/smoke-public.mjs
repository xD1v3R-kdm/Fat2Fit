/** Read-only smoke check for an ALREADY DEPLOYED Fat2Fit environment.
 * Usage: node scripts/smoke-public.mjs https://YOUR-APP.vercel.app
 * Never paste auth cookies, bot tokens, or DATABASE_URL into this command.
 */
const origin = process.argv[2];
if (!origin) { console.error('Usage: node scripts/smoke-public.mjs https://your-deployment.vercel.app'); process.exit(2); }
let u;
try { u = new URL(origin); }
catch { console.error('Invalid deployment URL'); process.exit(2); }
if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.pathname !== '/') {
  console.error('Use a clean HTTPS origin without credentials, path, query or fragment'); process.exit(2);
}
const checks = [
  {path: '/', expected: 200, name: 'Main page loads'},
  {path: '/api/me', expected: 401, name: 'Anonymous profile access denied'},
  {path: '/api/exercises?workspaceId=00000000-0000-4000-8000-000000000000', expected: 401, name: 'Anonymous exercise access denied'},
  {path: '/api/assignments?workspaceId=00000000-0000-4000-8000-000000000000', expected: 401, name: 'Anonymous assignments access denied'},
];
let fails = 0;
for (const check of checks) {
  try {
    const response = await fetch(new URL(check.path, u), {redirect: 'manual', signal: AbortSignal.timeout(12000), headers: {Accept: 'application/json'}});
    if (response.status !== check.expected) { fails++; console.error(`FAIL ${check.name}: HTTP ${response.status}, expected ${check.expected}`); }
    else console.log(`PASS ${check.name}: HTTP ${response.status}`);
  } catch (e) { fails++; console.error(`FAIL ${check.name}: ${e instanceof Error ? e.message : 'Network error'}`); }
}
if (fails) { console.error(`${fails} smoke check(s) failed. Do not invite testers yet.`); process.exit(1); }
console.log('All public smoke checks passed. Authorized Telegram and database E2E tests are still required.');
