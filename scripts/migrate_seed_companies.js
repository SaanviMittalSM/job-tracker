// One-time migration: pushes the previously-hardcoded company list into the
// Supabase `companies` table. Run once after add_companies_table.sql has been applied.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const fs = require('fs');

async function main() {
  const seed = JSON.parse(fs.readFileSync(process.argv[2] || 'seed.json', 'utf8'));
  const rows = seed.map(([company, portal_url, category]) => ({
    company, portal_url, category: category || 'Other',
    role_hint: category === 'Aggregator Portal' ? 'Search / monitor for new postings' : 'SDE Intern / New Grad',
    added_source: 'seed',
  }));
  const res = await fetch(`${SUPABASE_URL}/rest/v1/companies?on_conflict=company`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    console.error('Migration failed:', res.status, await res.text());
    process.exit(1);
  }
  console.log(`Migrated ${rows.length} companies into Supabase.`);
}

main();
