import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { runDvcLabScenario } from '../src/dvc-proof-lab.js';

globalThis.crypto ??= webcrypto;
const policy = JSON.parse(readFileSync(new URL('../credit-gate-policy-v1.0.0.json', import.meta.url), 'utf8'));
const vectors = JSON.parse(readFileSync(new URL('../dvc/test-vectors/credit-gate-v1.json', import.meta.url), 'utf8'));
const now = 1_800_000_000;

test('DVC Lab eligible case produces only the minimal public claim', async () => {
  const result = await runDvcLabScenario(policy, 'eligible', now);
  assert.equal(result.state, 'eligible');
  assert.deepEqual(Object.keys(result.publicOutput).sort(), ['chainId', 'eligible', 'expiresAt', 'policyHash', 'subject']);
  assert.equal(result.signatureStatus, 'NOT CHECKED · synthetic fixture only');
  assert.equal(JSON.stringify(result.publicOutput).includes('1250000'), false);
});

test('DVC Lab distinguishes valid but below-threshold claims from rejected proofs', async () => {
  const result = await runDvcLabScenario(policy, 'below-threshold', now);
  assert.equal(result.state, 'ineligible');
  assert.equal(result.publicOutput.eligible, false);
  assert.equal(result.checks.find(({ id }) => id === 'rule').state, 'deny');
});

test('DVC Lab rejects tampered policy, wrong subject, expired and wrong-source fixtures', async () => {
  for (const scenario of ['tampered-policy', 'wrong-subject', 'expired', 'wrong-source']) {
    const result = await runDvcLabScenario(policy, scenario, now);
    assert.equal(result.state, 'rejected', scenario);
    assert.equal(result.publicOutput, null, scenario);
  }
});

test('shared conformance vectors are pinned to policy and pass in the browser runner', async () => {
  assert.equal(vectors.schema, 'primus-credit-gate-test-vectors/v1');
  assert.equal(vectors.policyHash, policy.policyHash);
  assert.equal(vectors.vectors.length, 8);
  for (const vector of vectors.vectors) {
    const result = await runDvcLabScenario(policy, vector.id, vectors.fixedNow);
    assert.equal(result.state, vector.expected, vector.id);
    assert.equal(result.signatureStatus, 'NOT CHECKED · synthetic fixture only', vector.id);
  }
});
