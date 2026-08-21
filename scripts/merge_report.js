// Turns a WebSearch-discovery routine's markdown report into Supabase writes.
// Routines can't persist data themselves (confirmed: no Supabase network access,
// no git push access) — their only output is the final answer text. This script
// is the "merge" half of the manual cycle: fetch the report, run this on it.
//
// Usage: node scripts/merge_report.js path/to/report.txt
//
// Expected report format (what the routines are instructed to produce):
//   ### <Category>
//   **<Company>**
//   - <Title> - <URL> - deadline: <YYYY-MM-DD or 'not stated'>
//   - no current opening found
//
// Quality filter: URLs that look like a bare domain/homepage (no job-specific
// path) are flagged as likely-generic and SKIPPED by default, printed separately
// for manual review — never silently inserted as if they were targeted postings.

const fs = require('fs');

function supabaseCreds() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  return { url, key };
}

function looksGeneric(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, ''); // strip trailing slash
    const segments = path.split('/').filter(Boolean);
    // Bare domain or a single generic segment like "/careers" or "/jobs" with no id/slug.
    if (segments.length === 0) return true;
    if (segments.length === 1 && /^(careers?|jobs?|internships?|students?)$/i.test(segments[0])) return true;
    return false;
  } catch {
    return true; // unparseable URL — treat as suspicious
  }
}

function parseReport(text) {
  const lines = text.split('\n');
  let category = null, company = null;
  const postings = []; // {company, category, title, url, deadline}
  const noOpening = []; // company names explicitly marked "no current opening"
  const skipped = []; // {company, title, url} flagged generic

  for (const raw of lines) {
    const line = raw.trim();
    const catMatch = line.match(/^###\s+(.+)$/);
    if (catMatch) { category = catMatch[1].trim(); continue; }

    const companyMatch = line.match(/^\*\*(.+?)\*\*$/);
    if (companyMatch) { company = companyMatch[1].trim(); continue; }

    if (!line.startsWith('-') || !company) continue;
    const body = line.replace(/^-\s*/, '').replace(/^\(or\)\s*/i, '');

    if (/no current opening found/i.test(body)) {
      noOpening.push({ company, category });
      continue;
    }

    const urlMatch = body.match(/(https?:\/\/\S+?)(?=\s*-\s*deadline|\s*$)/);
    if (!urlMatch) continue; // not a parseable posting line, skip silently
    const url = urlMatch[1].replace(/[),.]+$/, ''); // trim trailing punctuation
    const title = body.slice(0, urlMatch.index).replace(/-\s*$/, '').trim();
    const deadlineMatch = body.match(/deadline:\s*([\d-]{10})/i);
    const deadline = deadlineMatch ? deadlineMatch[1] : null;

    if (looksGeneric(url)) {
      skipped.push({ company, title, url });
      continue;
    }
    postings.push({ company, category, title, url, deadline });
  }
  return { postings, noOpening, skipped };
}

async function upsert(table, rows, conflict) {
  if (!rows.length) return;
  const { url, key } = supabaseCreds();
  const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${conflict}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Upsert ${table} failed: HTTP ${res.status} ${await res.text()}`);
}

async function main() {
  const file = process.argv[2];
  if (!file) { console.error('Usage: node scripts/merge_report.js path/to/report.txt'); process.exit(1); }
  const text = fs.readFileSync(file, 'utf8');
  const { postings, noOpening, skipped } = parseReport(text);

  const now = new Date().toISOString();
  const postingRows = postings.map(p => ({
    company: p.company, category: p.category || 'Other', title: p.title, url: p.url,
    deadline: p.deadline, source: 'websearch', last_checked_at: now,
  }));
  const allTouchedCompanies = [...new Set([...postings.map(p => p.company), ...noOpening.map(n => n.company)])];
  const checkRows = allTouchedCompanies.map(company => {
    const found = postings.find(p => p.company === company) || noOpening.find(n => n.company === company);
    return { company, category: found?.category || 'Other', last_checked_at: now, source: 'websearch' };
  });

  await upsert('company_checks', checkRows, 'company');
  await upsert('postings', postingRows, 'company,url');

  console.log(`Merged: ${postingRows.length} targeted posting(s) across ${allTouchedCompanies.length} companies checked.`);
  if (noOpening.length) console.log(`No opening found: ${noOpening.map(n => n.company).join(', ')}`);
  if (skipped.length) {
    console.log(`\nSKIPPED as likely-generic (review manually if any of these are actually specific):`);
    skipped.forEach(s => console.log(`  - ${s.company}: ${s.title || '(no title)'} — ${s.url}`));
  }
}

module.exports = { parseReport, looksGeneric, main };
if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
