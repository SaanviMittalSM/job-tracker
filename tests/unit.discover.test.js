// Unit tests for the pure filtering logic in scripts/discover.js — no network, no Supabase.
const assert = require('assert');
const { isEntryLevel, INDIA_RE } = require('../scripts/discover.js');

const cases = [];
function t(name, fn) { cases.push({ name, fn }); }

// --- isEntryLevel: true positives (broadened scope) ---
t('SDE intern title passes', () => assert.strictEqual(isEntryLevel('Software Engineer, Intern'), true));
t('plain Software Engineer passes (no seniority marker)', () => assert.strictEqual(isEntryLevel('Software Engineer'), true));
t('AI Engineer passes', () => assert.strictEqual(isEntryLevel('AI Engineer'), true));
t('ML Engineer passes', () => assert.strictEqual(isEntryLevel('ML Engineer'), true));
t('Machine Learning Engineer passes', () => assert.strictEqual(isEntryLevel('Machine Learning Engineer'), true));
t('Data Engineer passes', () => assert.strictEqual(isEntryLevel('Data Engineer'), true));
t('Data Scientist passes', () => assert.strictEqual(isEntryLevel('Data Scientist'), true));
t('Backend Engineer passes', () => assert.strictEqual(isEntryLevel('Backend Engineer, Geo Team'), true));
t('Fullstack Engineer passes', () => assert.strictEqual(isEntryLevel('Intermediate Fullstack Engineer - Data Products'), true));
t('Cloud Engineer passes', () => assert.strictEqual(isEntryLevel('Cloud Engineer'), true));
t('DevOps Engineer passes', () => assert.strictEqual(isEntryLevel('DevOps Engineer'), true));
t('Site Reliability Engineer passes', () => assert.strictEqual(isEntryLevel('Site Reliability Engineer'), true));
t('Platform Engineer passes', () => assert.strictEqual(isEntryLevel('Platform Engineer'), true));
t('QA Engineer passes', () => assert.strictEqual(isEntryLevel('QA Engineer'), true));
t('SDET passes', () => assert.strictEqual(isEntryLevel('SDET'), true));
t('IT Automation and AI Engineer passes', () => assert.strictEqual(isEntryLevel('IT Automation and AI Engineer'), true));
t('Associate Application Engineer passes (entry signal)', () => assert.strictEqual(isEntryLevel('Associate Application Engineer'), true));

// --- isEntryLevel: false positives that must stay excluded ---
t('Senior Software Engineer excluded', () => assert.strictEqual(isEntryLevel('Senior Software Engineer'), false));
t('Staff Engineer excluded', () => assert.strictEqual(isEntryLevel('Staff Engineer'), false));
t('Director of Engineering excluded', () => assert.strictEqual(isEntryLevel('Director of Engineering'), false));
t('Engineering Manager excluded', () => assert.strictEqual(isEntryLevel('Engineering Manager - Backend'), false));
t('Principal Engineer excluded', () => assert.strictEqual(isEntryLevel('Principal Engineer'), false));
t('Sales Engineer excluded', () => assert.strictEqual(isEntryLevel('Sales Engineer - Enterprise'), false));
t('Solutions Engineer excluded', () => assert.strictEqual(isEntryLevel('Solutions Engineer, Okta'), false));
t('Technical Support Engineer excluded', () => assert.strictEqual(isEntryLevel('Technical Support Engineer 1'), false));
t('Customer Engineer excluded', () => assert.strictEqual(isEntryLevel('Customer Engineer, India (Based in Mumbai)'), false));
t('AI buzzword in Finance role excluded', () => assert.strictEqual(isEntryLevel('AI Specialist, Treasury Finance Operations'), false));
t('Cloud buzzword in Billing role excluded', () => assert.strictEqual(isEntryLevel('Cloud Billing Associate'), false));
t('Sales Consultant with AI in product name excluded', () => assert.strictEqual(isEntryLevel('GTM & Enterprise Sales Consultant – Meesho AI Services (MAS)'), false));
t('non-technical role fails ROLE_RE entirely', () => assert.strictEqual(isEntryLevel('Executive Assistant'), false));

// --- INDIA_RE: must not false-positive on "Indiana"/"Indianapolis" (regression guard) ---
t('India location matches', () => assert.strictEqual(INDIA_RE.test('Bengaluru, India'), true));
t('Bengaluru alone matches', () => assert.strictEqual(INDIA_RE.test('Bengaluru'), true));
t('Chennai, Tamil Nadu, India matches', () => assert.strictEqual(INDIA_RE.test('Chennai, Tamil Nadu, India'), true));
t('Indianapolis, IN does NOT match (regression: word-boundary bug)', () => assert.strictEqual(INDIA_RE.test('Indianapolis, IN'), false));
t('Indiana does NOT match (regression: word-boundary bug)', () => assert.strictEqual(INDIA_RE.test('Indiana'), false));
t('San Francisco, CA does not match', () => assert.strictEqual(INDIA_RE.test('San Francisco, CA'), false));

module.exports = cases;

if (require.main === module) {
  let pass = 0, fail = 0;
  for (const { name, fn } of cases) {
    try { fn(); pass++; console.log(`  ok - ${name}`); }
    catch (e) { fail++; console.log(`  FAIL - ${name}: ${e.message}`); }
  }
  console.log(`\nunit.discover: ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}
