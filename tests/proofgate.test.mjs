import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet, Interface } from 'ethers';
import { readFile } from 'node:fs/promises';
import { issueChallenge, encodeChallenge, decodeChallenge, binding, signingMessage, verifySubmission, settings, TEMPLATE, TASK_ABI, validateTask, consumeNonce, rateLimit } from '../lib/proofgate.js';

const config = { secret: 'test-only-secret-'.repeat(4), origin: 'https://example.test' };
const wallet = Wallet.createRandom();
const taskId = '0x' + 'ab'.repeat(32);
const attestor = '0x' + '11'.repeat(20);
const now = 1800000000;
test('server ABI matches installed official queryTask schema', async () => {
  const official = JSON.parse(await readFile(new URL('../node_modules/@primuslabs/network-js-sdk/src/config/taskAbi.json', import.meta.url)));
  const expected = new Interface(official).getFunction('queryTask').format('full');
  assert.equal(new Interface(TASK_ABI).getFunction('queryTask').format('full'), expected);
});
function fixture(c) {
  return { taskStatus: 1, templateId: TEMPLATE, submitter: wallet.address, submittedAt: BigInt(now + 1), attestors: [attestor], taskResults: [{ taskId, attestor, attestation: { recipient: wallet.address, additionParams: binding(c) } }] };
}
async function submission(c) {
  return { challenge: c.challenge, taskId, signature: await wallet.signMessage(signingMessage(c, taskId)), verified: true };
}
test('missing production configuration fails closed', () => assert.throws(() => settings({}), /configuration/));
test('malformed signed payloads fail as validation errors, not TypeErrors', () => {
  for (const value of [null, [], 'value', 1]) assert.throws(() => decodeChallenge(encodeChallenge(value, config.secret), config, now), e => e.status === 400);
});
test('unconfirmed task returns retryable status without accepting partial failure', () => {
  const c = issueChallenge(wallet.address, 'credit-rail', config, now);
  assert.throws(() => validateTask({ taskStatus: 0 }, c, taskId, now + 10), e => e.status === 425);
  assert.throws(() => validateTask({ taskStatus: 2 }, c, taskId, now + 10), e => e.status === 422);
});
test('invalid RPC configuration gives a safe configuration error', () => {
  assert.throws(() => settings({ PROOFGATE_SECRET: config.secret, PROOFGATE_ORIGIN: config.origin, PROOFGATE_RPC_URL: 'not-a-url', UPSTASH_REDIS_REST_URL: 'https://redis.test', UPSTASH_REDIS_REST_TOKEN: 'test' }), e => e.status === 503 && e.message === 'Invalid server configuration.');
});
test('challenge includes no secret, binds audience and expires', () => {
  const c = issueChallenge(wallet.address, 'credit-rail', config, now);
  assert.equal(decodeChallenge(c.challenge, config, now + 1).audience, 'credit-rail');
  assert.ok(!JSON.stringify(c).includes(config.secret));
  assert.throws(() => decodeChallenge(c.challenge, config, now + 900), /expired/);
  assert.throws(() => issueChallenge(wallet.address, 'attacker', config, now), /consumer/);
});
test('tampering, wrong origin and future issuance rejected', () => {
  const c = issueChallenge(wallet.address, 'credit-rail', config, now);
  assert.throws(() => decodeChallenge(c.challenge.slice(0, -3) + 'abc', config, now), /signature/);
  assert.throws(() => decodeChallenge(c.challenge, { ...config, origin: 'https://other.test' }, now), /belong/);
  assert.throws(() => decodeChallenge(c.challenge, config, now - 1), /expired/);
});
test('valid confirmed fixture issues minimal receipt once', async () => {
  const c = issueChallenge(wallet.address, 'credit-rail', config, now);
  const body = await submission(c);
  let consumed = false;
  const dependencies = { now: () => now + 10, read: async () => fixture(c), consume: async () => { if (consumed) throw new Error('Replay'); consumed = true; } };
  const result = await verifySubmission(body, config, dependencies);
  assert.equal(result.verified, true);
  assert.equal(result.receipt.scope, 'source-attestation-only');
  assert.equal(result.receipt.audience, 'credit-rail');
  assert.equal(result.receipt.data, undefined);
  await assert.rejects(verifySubmission(body, config, dependencies), /Replay/);
});
test('client-supplied success never overrides failed task', async () => {
  const c = issueChallenge(wallet.address, 'credit-rail', config, now);
  await assert.rejects(verifySubmission(await submission(c), config, { now: () => now + 10, read: async () => ({ ...fixture(c), taskStatus: 2 }), consume: async () => assert.fail('must not consume') }), /successful/);
});
for (const [name, mutate] of Object.entries({
  'wrong template': t => { t.templateId = 'wrong'; },
  'wrong submitter': t => { t.submitter = attestor; },
  'old task': t => { t.submittedAt = now - 1; },
  'future task': t => { t.submittedAt = now + 99; },
  'empty results': t => { t.taskResults = []; },
  'unassigned attestor': t => { t.taskResults[0].attestor = wallet.address; },
  'wrong task': t => { t.taskResults[0].taskId = '0x' + 'cd'.repeat(32); },
  'wrong recipient': t => { t.taskResults[0].attestation.recipient = attestor; },
  'missing nonce': t => { t.taskResults[0].attestation.additionParams = ''; },
  'duplicate attestor': t => { t.attestors.push(attestor); t.taskResults.push(t.taskResults[0]); },
})) {
  test(`rejects ${name}`, () => {
    const c = issueChallenge(wallet.address, 'credit-rail', config, now), t = fixture(c); mutate(t);
    assert.throws(() => validateTask(t, c, taskId, now + 10));
  });
}
test('proof cannot be used by another consumer', () => {
  const first = issueChallenge(wallet.address, 'credit-rail', config, now);
  const second = issueChallenge(wallet.address, 'partner-preview', config, now);
  assert.throws(() => validateTask(fixture(first), second, taskId, now + 10), /bind/);
});
test('signature by another wallet rejected before RPC', async () => {
  const c = issueChallenge(wallet.address, 'credit-rail', config, now), body = await submission(c);
  body.signature = await Wallet.createRandom().signMessage(signingMessage(c, taskId));
  await assert.rejects(verifySubmission(body, config, { now: () => now + 10, read: async () => assert.fail('RPC must not run') }), /signature/);
});
test('expiry during RPC rejected before consumption', async () => {
  const c = issueChallenge(wallet.address, 'credit-rail', config, now), body = await submission(c);
  let clock = now + 10;
  await assert.rejects(verifySubmission(body, config, { now: () => clock, read: async () => { clock = now + 900; return fixture(c); }, consume: async () => assert.fail('must not consume') }), /expired/);
});
test('replay-store failure does not issue receipt', async () => {
  const c = issueChallenge(wallet.address, 'credit-rail', config, now);
  await assert.rejects(verifySubmission(await submission(c), config, { now: () => now + 10, read: async () => fixture(c), consume: async () => { throw new Error('store offline'); } }), /offline/);
});
test('Redis consumption is atomic and fails closed on replay/error', async () => {
  const original = globalThis.fetch;
  const c = issueChallenge(wallet.address, 'credit-rail', config, now);
  try {
    globalThis.fetch = async (_, options) => {
      const command = JSON.parse(options.body);
      assert.deepEqual(command.slice(2), ['used', 'NX', 'EX', 890]);
      return { ok: true, json: async () => ({ result: 'OK' }) };
    };
    await consumeNonce(c, { ...config, redis: 'https://redis.test', token: 'test' }, now + 10);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ result: null }) });
    await assert.rejects(consumeNonce(c, config, now + 10), /consumed/);
    globalThis.fetch = async () => ({ ok: false });
    await assert.rejects(consumeNonce(c, config, now + 10), /unavailable/);
  } finally { globalThis.fetch = original; }
});
test('shared rate limiter denies excessive requests and storage failure', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ result: 13 }) });
    await assert.rejects(rateLimit({ headers: {} }, config), /Too many/);
    globalThis.fetch = async () => ({ ok: false });
    await assert.rejects(rateLimit({ headers: {} }, config), /unavailable/);
  } finally { globalThis.fetch = original; }
});
