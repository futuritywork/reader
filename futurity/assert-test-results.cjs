const fs = require('node:fs');

const output = fs.readFileSync(process.argv[2], 'utf8').replace(/\x1b\[[0-9;]*m/g, '');
const counts = (name) => [...output.matchAll(new RegExp(`^ℹ ${name} (\\d+)$`, 'gm'))]
  .map((match) => Number(match[1]));
const tests = counts('tests');
const passed = counts('pass');
const failed = counts('fail');
const cancelled = counts('cancelled');
if ([tests, passed, failed, cancelled].some((values) => values.length !== 3)
    || tests.some((count, index) => count === 0 || passed[index] !== count)
    || failed.some(Boolean) || cancelled.some(Boolean)) {
  console.error('Reader regression summaries are incomplete or contain failures.');
  process.exit(1);
}
console.log(`Verified ${passed.reduce((sum, count) => sum + count, 0)} passing regressions.`);
