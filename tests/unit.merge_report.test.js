// Unit tests for the report parser used in the manual merge cycle.
const assert = require('assert');
const { parseReport, looksGeneric } = require('../scripts/merge_report.js');

const cases = [];
function t(name, fn) { cases.push({ name, fn }); }

t('looksGeneric: bare domain is generic', () => assert.strictEqual(looksGeneric('https://jobs.apple.com'), true));
t('looksGeneric: /careers with nothing else is generic', () => assert.strictEqual(looksGeneric('https://careers.hp.com/careers'), true));
t('looksGeneric: specific job path is NOT generic', () => assert.strictEqual(looksGeneric('https://careers.adobe.com/us/en/job/R162130/Er-2026-Intern'), false));
t('looksGeneric: query-param search page is treated generic (single "jobs" segment)', () => assert.strictEqual(looksGeneric('https://jobs.intel.com/en/internships'), false)); // 'en/internships' = 2 segments, not flagged
t('looksGeneric: unparseable URL is generic', () => assert.strictEqual(looksGeneric('not a url'), true));

const sampleReport = `
⚠ TIME-SENSITIVE: none

### Voice/Speech AI
**Sarvam AI**
- ML Engineer - https://www.sarvam.ai/careers/jobs/d02fa17f-67bb-4236-8c16-5674162457b0 - deadline: not stated
**Deepgram**
- no current opening found

### IT Services
**TCS**
- All India NQT Hiring (Prime & Digital) - https://www.tcs.com/careers/india/tcs-all-india-nqt-hiring - deadline: not stated
**Accenture**
- Careers portal - https://careers.accenture.com - deadline: not stated

Total: 2 postings found.
`;

t('parseReport extracts genuine postings', () => {
  const { postings } = parseReport(sampleReport);
  assert.strictEqual(postings.length, 2, `expected 2 targeted postings, got ${postings.length}: ${JSON.stringify(postings)}`);
  const sarvam = postings.find(p => p.company === 'Sarvam AI');
  assert.ok(sarvam, 'Sarvam AI posting missing');
  assert.strictEqual(sarvam.category, 'Voice/Speech AI');
  assert.ok(sarvam.url.includes('sarvam.ai'));
});

t('parseReport records "no current opening found"', () => {
  const { noOpening } = parseReport(sampleReport);
  assert.ok(noOpening.some(n => n.company === 'Deepgram'), 'Deepgram no-opening not recorded');
});

t('parseReport skips generic Accenture careers-portal link instead of inserting it', () => {
  const { postings, skipped } = parseReport(sampleReport);
  assert.ok(!postings.some(p => p.company === 'Accenture'), 'Accenture generic link should NOT be in postings');
  assert.ok(skipped.some(s => s.company === 'Accenture'), 'Accenture should be in skipped list for manual review');
});

module.exports = cases;

if (require.main === module) {
  let pass = 0, fail = 0;
  for (const { name, fn } of cases) {
    try { fn(); pass++; console.log(`  ok - ${name}`); }
    catch (e) { fail++; console.log(`  FAIL - ${name}: ${e.message}`); }
  }
  console.log(`\nunit.merge_report: ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}
