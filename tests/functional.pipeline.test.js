// Functional tests: does the discovery pipeline actually run end-to-end, and is the
// deployed app actually reachable and structurally sound? These hit real network
// endpoints (Greenhouse/Lever/Supabase/GitHub Pages) — this is intentional, it's testing
// the real pipeline, not a mock of it.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  });
}
loadEnv();

const cases = [];
function t(name, fn) { cases.push({ name, fn }); }

// --- Live pipeline run ---
t('discover.js runs end-to-end without throwing', async () => {
  const { main } = require('../scripts/discover.js');
  await main(); // will throw and fail the test if any step errors
});

t('postings table has results after a fresh run (not silently empty)', async () => {
  const ANON = process.env.SUPABASE_ANON_KEY, URL = process.env.SUPABASE_URL;
  const res = await fetch(`${URL}/rest/v1/postings?select=id`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  const body = await res.json();
  assert.ok(body.length > 0, 'expected at least one live posting after a fresh discovery run');
});

t('no NON_SDE_RE violators present in live postings data (regression guard on deployed data)', async () => {
  const { NON_SDE_RE } = require('../scripts/discover.js');
  const ANON = process.env.SUPABASE_ANON_KEY, URL = process.env.SUPABASE_URL;
  const res = await fetch(`${URL}/rest/v1/postings?select=company,title&source=in.(greenhouse,lever)`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  const rows = await res.json();
  const violators = rows.filter(r => NON_SDE_RE.test(r.title));
  assert.strictEqual(violators.length, 0, `found excluded-category titles still live: ${JSON.stringify(violators)}`);
});

// --- Deployed PWA reachability ---
const PAGES_URL = 'https://saanvimittalsm.github.io/job-tracker';
for (const asset of ['index.html', 'manifest.json', 'icon.svg', 'sw.js']) {
  t(`deployed asset ${asset} is reachable (200)`, async () => {
    const res = await fetch(`${PAGES_URL}/${asset}`);
    assert.strictEqual(res.status, 200, `${asset} returned HTTP ${res.status}`);
  });
}

t('manifest.json is valid JSON with required PWA fields', async () => {
  const res = await fetch(`${PAGES_URL}/manifest.json`);
  const json = await res.json();
  for (const field of ['name', 'short_name', 'start_url', 'display', 'icons']) {
    assert.ok(field in json, `manifest.json missing '${field}'`);
  }
});

// --- Static structural checks on index.html (catches leftover-reference bugs) ---
t('index.html does not reference the removed hardcoded SEED array', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(!/\bSEED\.(filter|map|forEach)/.test(html), 'found leftover SEED.* usage — should read from Supabase companies table now');
});

t('index.html script block is syntactically valid JS', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  assert.ok(m, 'no inline <script> block found');
  new Function(m[1]); // throws SyntaxError if malformed
});

t('index.html references the live Supabase project URL (not a stale one)', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.includes(process.env.SUPABASE_URL || 'kpyuqalsfhvxmjvaczxr'), 'SUPABASE_URL in index.html does not match .env');
});

t('discover.yml workflow references both required secrets', () => {
  const yml = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'discover.yml'), 'utf8');
  assert.ok(yml.includes('secrets.SUPABASE_URL'), 'workflow missing SUPABASE_URL secret reference');
  assert.ok(yml.includes('secrets.SUPABASE_SERVICE_ROLE_KEY'), 'workflow missing SUPABASE_SERVICE_ROLE_KEY secret reference');
});

module.exports = cases;

if (require.main === module) {
  (async () => {
    let pass = 0, fail = 0;
    for (const { name, fn } of cases) {
      try { await fn(); pass++; console.log(`  ok - ${name}`); }
      catch (e) { fail++; console.log(`  FAIL - ${name}: ${e.message}`); }
    }
    console.log(`\nfunctional.pipeline: ${pass} passed, ${fail} failed`);
    if (fail) process.exit(1);
  })();
}
