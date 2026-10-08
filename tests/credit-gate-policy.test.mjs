import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { canonicalizePolicy, verifyCompiledPolicy } from '../src/credit-gate-policy.js';

async function compile(policy) {
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalizePolicy(policy)));
  return { ...policy, policyHash: `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}` };
}

const policy = {
  schema: 'primus-credit-gate-policy/v1', name: 'Volume gate', version: '1.0.0',
  source: { provider: 'binance' }, rule: { threshold: 1000000 },
  binding: { chainId: 84532, expiresInSeconds: 900 },
};

test('compiled policy verifies its canonical SHA-256 and rejects changed content', async () => {
  const compiled = await compile(policy);
  assert.equal(await verifyCompiledPolicy(compiled, webcrypto.subtle), compiled);
  await assert.rejects(verifyCompiledPolicy({ ...compiled, rule: { threshold: 1 } }, webcrypto.subtle), /hash mismatch/);
});

test('policy verifier rejects malformed or incomplete files', async () => {
  await assert.rejects(verifyCompiledPolicy({}, webcrypto.subtle), /compiled Credit Gate/);
  const compiled = await compile(policy);
  await assert.rejects(verifyCompiledPolicy({ ...compiled, binding: {} }, webcrypto.subtle), /incomplete or invalid/);
});
