import test from 'node:test';
import assert from 'node:assert/strict';
import { createProofGateClient } from '../src/proofgate-client.js';
import { apiRequest, signingMessage } from '../src/proofgate-protocol.js';
import { issueChallenge, signingMessage as serverMessage } from '../lib/proofgate.js';

const wallet = '0x' + '11'.repeat(20), other = '0x' + '22'.repeat(20), taskId = '0x' + 'ab'.repeat(32);
const now = 1800000000, origin = 'https://example.test';
function setup(options = {}) {
  const state = { wallet, chain: '0x14a34', proofs: 0, verifications: 0, signs: 0, clock: now, signedMessage: '', sent: [] };
  const c = issueChallenge(wallet, 'credit-rail', { origin, secret: 'test-secret-'.repeat(4) }, now);
  const provider = { async request({ method, params }) {
    if (method === 'eth_chainId') return state.chain;
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return state.wallet ? [state.wallet] : [];
    if (method === 'personal_sign') { state.signs++; state.signedMessage = Buffer.from(params[0].slice(2), 'hex').toString(); options.sign?.(state); return '0x' + 'aa'.repeat(65); }
    assert.fail(method);
  } };
  const run = createProofGateClient({ getProvider: () => provider, origin: () => origin, now: () => state.clock,
    sleep: async () => {}, runProof: async () => { state.proofs++; options.proof?.(state); return { task: { taskId } }; },
    post: async body => {
      state.sent.push(body);
      if (body.action === 'challenge') return options.challenge ? options.challenge(c) : c;
      state.verifications++;
      if (options.verify) return options.verify(state, body);
      return { verified: true, receipt: { wallet, taskId, audience: 'credit-rail', scope: 'source-attestation-only' } };
    },
  });
  return { state, run, c };
}
test('browser signs exact server message and sends only minimal verification fields', async () => {
  const { state, run, c } = setup(); await run();
  assert.equal(state.signedMessage, serverMessage(c, taskId));
  assert.equal(signingMessage(c, taskId), serverMessage(c, taskId));
  assert.deepEqual(Object.keys(state.sent[1]).sort(), ['action', 'challenge', 'signature', 'taskId']);
});
test('pending blocks retry verification without another transaction', async () => {
  const { state, run } = setup({ verify: s => {
    if (s.verifications < 3) throw Object.assign(new Error('pending'), { status: 425 });
    return { verified: true, receipt: { wallet, taskId, audience: 'credit-rail', scope: 'source-attestation-only' } };
  } });
  await run(); assert.equal(state.proofs, 1); assert.equal(state.signs, 1); assert.equal(state.verifications, 3);
});
test('permanent failures and ambiguous timeouts are not retried', async () => {
  for (const status of [409, 422, 503, undefined]) {
    const { state, run } = setup({ verify: () => { throw Object.assign(new Error('failed'), { status }); } });
    await assert.rejects(run(), /failed/); assert.equal(state.verifications, 1); assert.equal(state.proofs, 1);
  }
});
test('pending-state retry budget is bounded', async () => {
  const { state, run } = setup({ verify: () => { throw Object.assign(new Error('pending'), { status: 425 }); } });
  await assert.rejects(run(), /pending/); assert.equal(state.verifications, 8); assert.equal(state.proofs, 1);
});
test('wallet change during proof stops before signing', async () => {
  const { state, run } = setup({ proof: s => { s.wallet = other; } });
  await assert.rejects(run(), /Wallet changed/); assert.equal(state.signs, 0); assert.equal(state.verifications, 0);
});
test('network change during signing stops before redemption', async () => {
  const { state, run } = setup({ sign: s => { s.chain = '0x2105'; } });
  await assert.rejects(run(), /network changed/); assert.equal(state.verifications, 0);
});
test('expiry during a wallet prompt stops before redemption', async () => {
  const { state, run } = setup({ sign: s => { s.clock = now + 900; } });
  await assert.rejects(run(), /expired/); assert.equal(state.verifications, 0);
});
test('invalid challenge does not submit a proof transaction', async () => {
  const { state, run } = setup({ challenge: c => ({ ...c, origin: 'https://attacker.test' }) });
  await assert.rejects(run(), /Invalid/); assert.equal(state.proofs, 0);
});
test('duplicate invocation is rejected and lock is released after failure', async () => {
  const { run } = setup({ verify: () => { throw new Error('failed'); } });
  const first = run();
  await assert.rejects(run(), /already running/); await assert.rejects(first, /failed/);
  await assert.rejects(run(), /failed/);
});
test('malformed success receipt is not displayed as verified', async () => {
  const { run } = setup({ verify: () => ({ verified: true }) });
  await assert.rejects(run(), /receipt/);
});
test('API transport handles HTML, null JSON, failure status and timeout', async () => {
  await assert.rejects(apiRequest({}, { fetchFn: async () => ({ json: async () => { throw new Error(); } }) }), /unreadable/);
  await assert.rejects(apiRequest({}, { fetchFn: async () => ({ ok: true, json: async () => null }) }), /Invalid/);
  await assert.rejects(apiRequest({}, { fetchFn: async () => ({ ok: false, status: 425, json: async () => ({ error: 'pending' }) }) }), e => e.status === 425);
  await assert.rejects(apiRequest({}, { fetchFn: async (_url, { signal }) => { assert.ok(signal); throw new Error('timeout'); } }), /timed out/);
});
