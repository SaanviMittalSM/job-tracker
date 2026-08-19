// Pulls India-based SDE/intern postings from public Greenhouse and Lever job-board APIs
// (both explicitly designed for programmatic read access — no scraping, no ToS issue)
// and merges them into postings.json for the tracker dashboard to consume via GitHub sync.
const fs = require('fs');

const GREENHOUSE = {
  anthropic: 'Anthropic', figma: 'Figma', databricks: 'Databricks', scaleai: 'Scale AI',
  assemblyai: 'AssemblyAI', stripe: 'Stripe', slice: 'Slice', gitlab: 'GitLab',
  elastic: 'Elastic', mongodb: 'MongoDB', cloudflare: 'Cloudflare', okta: 'Okta',
  zscaler: 'Zscaler', twilio: 'Twilio', dropbox: 'Dropbox', postman: 'Postman', xai: 'xAI',
};
const LEVER = {
  plivo: 'Plivo', cred: 'CRED', meesho: 'Meesho', porter: 'Porter', freshworks: 'Freshworks',
};

const INDIA_RE = /\bindia\b|bengaluru|bangalore|hyderabad|\bpune\b|gurgaon|gurugram|\bnoida\b|\bmumbai\b|\bchennai\b|delhi ncr/i;
const ROLE_RE = /engineer|developer|\bsde\b|software|\bswe\b|programmer/i;
const SENIOR_RE = /senior|\bsr\.?\b|staff|principal|director|\bvp\b|vice president|head of|distinguished|architect|manager|\blead\b|\bii\b|\biii\b|\biv\b|\b[2-9]\+? ?years?\b/i;
const ENTRY_RE = /intern|new grad|university grad|graduate program|entry.level|associate|\bsde ?1\b|\bsde ?i\b|software engineer i\b|early career|campus/i;
// Customer/sales-facing "engineer" titles at SaaS companies aren't SDE roles despite matching ROLE_RE.
const NON_SDE_RE = /sales engineer|solutions engineer|support engineer|technical support|customer engineer|success engineer|escalation engineer|\bengineer,? india\b/i;

function isEntryLevel(title) {
  if (!ROLE_RE.test(title) || NON_SDE_RE.test(title)) return false;
  if (ENTRY_RE.test(title)) return true;
  return !SENIOR_RE.test(title);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'job-application-tracker-discovery (personal use)' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function discoverGreenhouse(token) {
  const data = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=false`);
  return (data.jobs || [])
    .filter(j => INDIA_RE.test(j.location?.name || '') && isEntryLevel(j.title || ''))
    .map(j => ({
      url: j.absolute_url,
      title: j.title,
      deadline: j.application_deadline ? String(j.application_deadline).slice(0, 10) : '',
    }));
}

async function discoverLever(token) {
  const data = await fetchJson(`https://api.lever.co/v0/postings/${token}?mode=json`);
  return (data || [])
    .filter(p => {
      const locs = [p.categories?.location, ...(p.categories?.allLocations || [])].filter(Boolean).join(' ');
      return INDIA_RE.test(locs) && isEntryLevel(p.text || '');
    })
    .map(p => ({ url: p.hostedUrl, title: p.text, deadline: '' }));
}

async function main() {
  const now = new Date().toISOString();
  const checkedThisRun = {};

  for (const [token, name] of Object.entries(GREENHOUSE)) {
    try {
      checkedThisRun[name] = { lastChecked: now, postings: await discoverGreenhouse(token), source: 'greenhouse' };
    } catch (e) {
      checkedThisRun[name] = { lastChecked: now, postings: [], source: 'greenhouse', error: String(e.message || e) };
    }
  }
  for (const [token, name] of Object.entries(LEVER)) {
    try {
      checkedThisRun[name] = { lastChecked: now, postings: await discoverLever(token), source: 'lever' };
    } catch (e) {
      checkedThisRun[name] = { lastChecked: now, postings: [], source: 'lever', error: String(e.message || e) };
    }
  }

  let existing = { companies: {} };
  if (fs.existsSync('postings.json')) {
    try { existing = JSON.parse(fs.readFileSync('postings.json', 'utf8')); } catch (e) { /* start fresh on parse failure */ }
  }
  // Keep companies discovered by other sources (e.g. the WebSearch-based routine) untouched;
  // overwrite only the companies this script actually checked.
  const merged = { ...(existing.companies || {}), ...checkedThisRun };
  fs.writeFileSync('postings.json', JSON.stringify({ generatedAt: now, companies: merged }, null, 2) + '\n');

  const totalPostings = Object.values(checkedThisRun).reduce((n, c) => n + c.postings.length, 0);
  const errored = Object.entries(checkedThisRun).filter(([, c]) => c.error).map(([name]) => name);
  console.log(`Checked ${Object.keys(checkedThisRun).length} companies via Greenhouse/Lever, found ${totalPostings} India-relevant posting(s).`);
  if (errored.length) console.log(`Errors fetching: ${errored.join(', ')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
