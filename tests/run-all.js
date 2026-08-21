// Runs unit, integration, and functional suites in order and prints one summary.
// Usage: node tests/run-all.js
const suites = [
  ['unit.discover', './unit.discover.test.js'],
  ['unit.merge_report', './unit.merge_report.test.js'],
  ['integration', './integration.supabase.test.js'],
  ['functional', './functional.pipeline.test.js'],
];

async function run() {
  let totalPass = 0, totalFail = 0;
  const failures = [];

  for (const [label, file] of suites) {
    console.log(`\n=== ${label} ===`);
    const cases = require(file);
    for (const { name, fn } of cases) {
      try {
        await fn();
        totalPass++;
        console.log(`  ok - ${name}`);
      } catch (e) {
        totalFail++;
        failures.push(`[${label}] ${name}: ${e.message}`);
        console.log(`  FAIL - ${name}: ${e.message}`);
      }
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`TOTAL: ${totalPass} passed, ${totalFail} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
  }
}

run();
