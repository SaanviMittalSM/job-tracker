// Pulls India-based SDE/intern postings from public Greenhouse and Lever job-board APIs
// (both explicitly designed for programmatic read access — no scraping, no ToS issue)
// and upserts them straight into Supabase (postings + company_checks tables).
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const GREENHOUSE = {
  anthropic: ['Anthropic', 'AI Research/Frontier'],
  figma: ['Figma', 'Global SaaS/Cloud'],
  databricks: ['Databricks', 'Global SaaS/Cloud'],
  scaleai: ['Scale AI', 'AI Research/Frontier'],
  assemblyai: ['AssemblyAI', 'Voice/Speech AI'],
  stripe: ['Stripe', 'Global SaaS/Cloud'],
  slice: ['Slice', 'Indian Product/Fintech'],
  gitlab: ['GitLab', 'Global SaaS/Cloud'],
  elastic: ['Elastic', 'Global SaaS/Cloud'],
  mongodb: ['MongoDB', 'Global SaaS/Cloud'],
  cloudflare: ['Cloudflare', 'Global SaaS/Cloud'],
  okta: ['Okta', 'Global SaaS/Cloud'],
  zscaler: ['Zscaler', 'Global SaaS/Cloud'],
  twilio: ['Twilio', 'Global SaaS/Cloud'],
  dropbox: ['Dropbox', 'Global SaaS/Cloud'],
  postman: ['Postman', 'Global SaaS/Cloud'],
  xai: ['xAI', 'AI Research/Frontier'],
};
const LEVER = {
  plivo: ['Plivo', 'Voice/Speech AI'],
  cred: ['CRED', 'Indian Product/Fintech'],
  meesho: ['Meesho', 'Indian Product/Fintech'],
  porter: ['Porter', 'Indian Product/Fintech'],
  freshworks: ['Freshworks', 'Indian Product/Fintech'],
};

const INDIA_RE = /\bindia\b|bengaluru|bangalore|hyderabad|\bpune\b|gurgaon|gurugram|\bnoida\b|\bmumbai\b|\bchennai\b|delhi ncr/i;
// Broadened beyond pure SDE titles: ML/AI, data, backend/full-stack, cloud/DevOps/SRE, QA, and general IT/tech roles.
const ROLE_RE = /engineer|developer|\bsde\b|software|\bswe\b|programmer|\bml\b|machine learning|\bai\b|artificial intelligence|data scientist|data engineer|backend|back-end|full.?stack|\bcloud\b|devops|\bsre\b|site reliability|platform engineer|infrastructure|\bqa\b|sdet|test engineer|mlops|applied scientist|research engineer|systems engineer|information technology|\bit\b support|network engineer/i;
const SENIOR_RE = /senior|\bsr\.?\b|staff|principal|director|\bvp\b|vice president|head of|distinguished|architect|manager|\blead\b|\bii\b|\biii\b|\biv\b|\b[2-9]\+? ?years?\b/i;
const ENTRY_RE = /intern|new grad|university grad|graduate program|entry.level|associate|junior|\bsde ?1\b|\bsde ?i\b|software engineer i\b|early career|campus/i;
const NON_SDE_RE = /sales engineer|solutions engineer|support engineer|technical support|customer engineer|success engineer|escalation engineer|\bengineer,? india\b|finance|treasury|billing|sales consultant|enterprise sales|marketing|recruiter|talent acquisition|hr business partner|\blegal\b|accounting/i;

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
      deadline: j.application_deadline ? String(j.application_deadline).slice(0, 10) : null,
    }));
}

async function discoverLever(token) {
  const data = await fetchJson(`https://api.lever.co/v0/postings/${token}?mode=json`);
  return (data || [])
    .filter(p => {
      const locs = [p.categories?.location, ...(p.categories?.allLocations || [])].filter(Boolean).join(' ');
      return INDIA_RE.test(locs) && isEntryLevel(p.text || '');
    })
    .map(p => ({ url: p.hostedUrl, title: p.text, deadline: null }));
}

async function supabaseUpsert(table, rows, conflictCols) {
  if (!rows.length) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflictCols}`, {
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
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase upsert into ${table} failed: HTTP ${res.status} ${body}`);
  }
}

async function supabaseDelete(table, filterQuery) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filterQuery}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=minimal',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase delete from ${table} failed: HTTP ${res.status} ${body}`);
  }
}

async function main() {
  const now = new Date().toISOString();
  const postingRows = [];
  const checkRows = [];
  let totalFound = 0;
  const errored = [];

  async function processSource(entries, discoverFn) {
    for (const [token, [name, category]] of Object.entries(entries)) {
      let postings = [];
      let source = discoverFn === discoverGreenhouse ? 'greenhouse' : 'lever';
      try {
        postings = await discoverFn(token);
      } catch (e) {
        errored.push(name);
        console.error(`  ${name}: ${e.message}`);
      }
      checkRows.push({ company: name, category, last_checked_at: now, source });
      postings.forEach(p => {
        postingRows.push({
          company: name, category, title: p.title, url: p.url,
          deadline: p.deadline, source, last_checked_at: now,
        });
      });
      totalFound += postings.length;
    }
  }

  await processSource(GREENHOUSE, discoverGreenhouse);
  await processSource(LEVER, discoverLever);

  // Replace semantics for the companies this script owns: clears postings that closed or
  // no longer match the filter, instead of accumulating stale rows forever via upsert-only.
  const ownedCompanies = [...Object.values(GREENHOUSE), ...Object.values(LEVER)].map(([name]) => name);
  await supabaseDelete('postings', `company=in.(${ownedCompanies.map(c => `"${c}"`).join(',')})&source=in.(greenhouse,lever)`);

  await supabaseUpsert('company_checks', checkRows, 'company');
  await supabaseUpsert('postings', postingRows, 'company,url');

  console.log(`Checked ${checkRows.length} companies via Greenhouse/Lever, found ${totalFound} India-relevant posting(s), upserted to Supabase.`);
  if (errored.length) console.log(`Errors fetching: ${errored.join(', ')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
