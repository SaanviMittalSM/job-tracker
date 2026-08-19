// Integration tests against the LIVE Supabase project: verifies tables exist and RLS
// policies actually behave as intended (public data readable, private data isolated,
// writes gated correctly). Read-only except for one insert+cleanup on `companies`
// (that table's own policy allows anon inserts, so this exercises the real path).
const assert = require('assert');

function loadEnv() {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  });
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const cases = [];
function t(name, fn) { cases.push({ name, fn }); }

async function anonGet(table, query = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

if (!SUPABASE_URL || !ANON_KEY) {
  console.log('SKIPPED: integration.supabase — missing SUPABASE_URL/SUPABASE_ANON_KEY in .env');
} else {

t('postings table exists and is publicly readable', async () => {
  const { status, body } = await anonGet('postings', 'select=id&limit=1');
  assert.strictEqual(status, 200, `expected 200, got ${status}`);
  assert.ok(Array.isArray(body), 'expected an array response');
});

t('companies table exists and is publicly readable', async () => {
  const { status, body } = await anonGet('companies', 'select=company&limit=1');
  assert.strictEqual(status, 200);
  assert.ok(Array.isArray(body));
});

t('company_checks table exists and is publicly readable', async () => {
  const { status, body } = await anonGet('company_checks', 'select=company&limit=1');
  assert.strictEqual(status, 200);
  assert.ok(Array.isArray(body));
});

t('applications table blocks anon reads (RLS: private per-user)', async () => {
  const { status, body } = await anonGet('applications', 'select=id&limit=5');
  assert.strictEqual(status, 200, 'PostgREST returns 200 with RLS-filtered empty set, not an error');
  assert.strictEqual(body.length, 0, `expected 0 rows visible to anon, got ${body.length} — RLS may be misconfigured or disabled`);
});

t('gmail_signals table blocks anon reads (RLS: private per-user)', async () => {
  const { status, body } = await anonGet('gmail_signals', 'select=id&limit=5');
  assert.strictEqual(status, 200);
  assert.strictEqual(body.length, 0, `expected 0 rows visible to anon, got ${body.length} — RLS may be misconfigured or disabled`);
});

t('anon cannot insert into postings (insert restricted to authenticated)', async () => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/postings`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ company: '__TEST_SHOULD_FAIL__', title: 't', url: 'https://example.com/should-not-exist', source: 'test' }),
  });
  assert.notStrictEqual(res.status, 201, `anon insert into postings should be rejected but got ${res.status}`);
});

t('anon CAN insert into companies (crowd-add policy), then cleanup verifies it landed', async () => {
  const marker = `__TEST_COMPANY_${Date.now()}__`;
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/companies`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ company: marker, category: 'Other', added_source: 'test' }),
  });
  assert.strictEqual(insertRes.status, 201, `expected 201, got ${insertRes.status}`);
  const { body } = await anonGet('companies', `select=company&company=eq.${encodeURIComponent(marker)}`);
  assert.strictEqual(body.length, 1, 'inserted test company should be readable back');
  // Cleanup via service_role (anon has no delete policy on companies, which is correct/expected).
  if (SERVICE_KEY) {
    await fetch(`${SUPABASE_URL}/rest/v1/companies?company=eq.${encodeURIComponent(marker)}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
    });
  }
});

t('postings rows have the shape index.html expects', async () => {
  const { body } = await anonGet('postings', 'select=*&limit=1');
  if (!body.length) { console.log('    (no postings rows to shape-check right now — not a failure)'); return; }
  const row = body[0];
  for (const col of ['id', 'company', 'category', 'title', 'url', 'source', 'last_checked_at']) {
    assert.ok(col in row, `postings row missing expected column '${col}'`);
  }
});

t('company_checks rows have the shape index.html expects', async () => {
  const { body } = await anonGet('company_checks', 'select=*&limit=1');
  if (!body.length) { console.log('    (no company_checks rows to shape-check right now — not a failure)'); return; }
  const row = body[0];
  for (const col of ['company', 'category', 'last_checked_at', 'source']) {
    assert.ok(col in row, `company_checks row missing expected column '${col}'`);
  }
});

}

module.exports = cases;

if (require.main === module) {
  (async () => {
    let pass = 0, fail = 0;
    for (const { name, fn } of cases) {
      try { await fn(); pass++; console.log(`  ok - ${name}`); }
      catch (e) { fail++; console.log(`  FAIL - ${name}: ${e.message}`); }
    }
    console.log(`\nintegration.supabase: ${pass} passed, ${fail} failed`);
    if (fail) process.exit(1);
  })();
}
