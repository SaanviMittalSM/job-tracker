// Exports the live company list + coverage state from Supabase into a JSON file
// committed to the repo. This is what lets WebSearch-based routines know the
// current dynamic company list WITHOUT hardcoding it into their prompts — routines
// can't reach Supabase directly (network policy), but they CAN read a file from
// their git checkout, so this snapshot is the bridge.
function supabaseCreds() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  return { url, key };
}

async function fetchAll(table, select) {
  const { url, key } = supabaseCreds();
  const res = await fetch(`${url}/rest/v1/${table}?select=${select}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Fetch ${table} failed: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const [companies, checks] = await Promise.all([
    fetchAll('companies', 'company,category,portal_url,role_hint'),
    fetchAll('company_checks', 'company,source,last_checked_at'),
  ]);
  const checkByCompany = Object.fromEntries(checks.map(c => [c.company, c]));
  const API_SOURCES = new Set(['greenhouse', 'lever', 'amazon']);

  const rows = companies
    .filter(c => c.category !== 'Aggregator Portal') // portals aren't employers, nothing to search for
    .map(c => {
      const check = checkByCompany[c.company];
      const coveredByApi = !!check && API_SOURCES.has(check.source);
      return {
        company: c.company,
        category: c.category,
        portal_url: c.portal_url,
        covered_by_api: coveredByApi,
        needs_websearch: !coveredByApi,
        last_checked_at: check ? check.last_checked_at : null,
      };
    });

  const fs = require('fs');
  fs.writeFileSync('companies_snapshot.json', JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalCompanies: rows.length,
    needsWebsearchCount: rows.filter(r => r.needs_websearch).length,
    companies: rows,
  }, null, 2) + '\n');

  console.log(`Exported snapshot: ${rows.length} companies (${rows.filter(r => r.needs_websearch).length} need WebSearch coverage).`);
}

module.exports = { main };
if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
