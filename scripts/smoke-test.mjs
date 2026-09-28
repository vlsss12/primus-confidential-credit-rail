import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const html = await readFile(resolve(process.cwd(), 'index.html'), 'utf8');
const required = [
  'Primus Confidential Credit Rail',
  'Run a live Primus proof',
  '@primuslabs/bnb-zkid-sdk',
  'function evaluatePolicy',
  'function downloadProof',
  'function runPrimusProof',
];

const missing = required.filter((needle) => !html.includes(needle));
if (missing.length) {
  console.error(`Smoke test failed. Missing: ${missing.join(', ')}`);
  process.exit(1);
}

if (html.includes('PRIVATE_KEY=') || html.includes('sk-')) {
  console.error('Smoke test failed. Possible secret material found in HTML.');
  process.exit(1);
}

console.log(`Smoke test passed: ${required.length} product markers checked.`);
