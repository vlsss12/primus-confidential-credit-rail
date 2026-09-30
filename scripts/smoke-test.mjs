import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const html = await readFile(resolve(process.cwd(), 'index.html'), 'utf8');
const adapter = await readFile(resolve(process.cwd(), 'src/primus-network.js'), 'utf8');
const required = [
  'Primus Confidential Credit Rail',
  'Run a live Primus proof',
  '@primuslabs/bnb-zkid-sdk',
  'function evaluatePolicy',
  'function downloadProof',
  'function runPrimusProof',
  'runPrimusNetworkProof',
  '@primuslabs/network-js-sdk',
];

const missing = required.filter((needle) => {
  const source = needle === 'runPrimusNetworkProof' ? adapter : `${html}\n${adapter}`;
  return !source.includes(needle);
});
if (missing.length) {
  console.error(`Smoke test failed. Missing: ${missing.join(', ')}`);
  process.exit(1);
}

if (html.includes('PRIVATE_KEY=') || html.includes('sk-')) {
  console.error('Smoke test failed. Possible secret material found in HTML.');
  process.exit(1);
}

const misleadingClaims = [
  'Attestation verified · 41 seconds ago',
  'A− / Institutional',
];
const staleClaims = misleadingClaims.filter((needle) => html.includes(needle));
if (staleClaims.length) {
  console.error(`Smoke test failed. Stale demo claims found: ${staleClaims.join(', ')}`);
  process.exit(1);
}

const unsafeLogging = ['console.log({address,task,attestation,result})', 'console.log({ address, task, attestation, result })'];
const foundUnsafeLogging = unsafeLogging.filter((needle) => html.includes(needle));
if (foundUnsafeLogging.length) {
  console.error('Smoke test failed. Raw attestation logging found in the browser bundle.');
  process.exit(1);
}

const sourceFiles = [html, adapter].join('\n');
const secretPatterns = [
  /PRIMUS_APP_SECRET\s*=\s*[^\s#]/i,
  /(?:private[_ -]?key|seed phrase|mnemonic)\s*[:=]\s*['\"][^'\"]+['\"]/i,
  /sk-[A-Za-z0-9]{20,}/,
];
if (secretPatterns.some((pattern) => pattern.test(sourceFiles))) {
  console.error('Smoke test failed. Secret-like material found in browser sources.');
  process.exit(1);
}

const vercelConfig = await readFile(resolve(process.cwd(), 'vercel.json'), 'utf8');
for (const header of ['X-Content-Type-Options', 'X-Frame-Options', 'Content-Security-Policy', 'Permissions-Policy']) {
  if (!vercelConfig.includes(header)) {
    console.error(`Smoke test failed. Missing security header: ${header}`);
    process.exit(1);
  }
}

for (const requiredDoc of ['docs/BUILDER_REVIEW.md', 'docs/INTEGRATION_REQUEST.md']) {
  try {
    await readFile(resolve(process.cwd(), requiredDoc), 'utf8');
  } catch {
    console.error(`Smoke test failed. Missing review document: ${requiredDoc}`);
    process.exit(1);
  }
}

console.log(`Smoke test passed: ${required.length} product markers checked.`);
