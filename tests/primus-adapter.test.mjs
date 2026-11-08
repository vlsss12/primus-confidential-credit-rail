import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareDvcRequest, runPrimusNetworkProof } from '../src/primus-network.js';
const address = '0x' + '11'.repeat(20), taskId = '0x' + 'ab'.repeat(32);
const privateResponse = { id: 'binance-response-0', content: '{"data":{"volume":"123.45"}}' };
async function committedAttestation(response = privateResponse) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(response.content));
  const hash = Buffer.from(digest).toString('hex');
  return { taskId, attestation: { data: JSON.stringify({ [response.id]: hash }) } };
}
test('adapter blocks chain changes, expiry, empty results and task mismatch', async () => {
  const oldWindow = globalThis.window;
  try {
      for (const mode of ['chain-change', 'expired', 'empty', 'wrong-task', 'empty-result', 'valid']) {
      let chain = '0x14a34', clock = 100, submits = 0, received;
      globalThis.window = { ethereum: { async request({ method }) { return method === 'eth_chainId' ? chain : [address]; } } };
      class Network {
        async init() { if (mode === 'chain-change') chain = '0x2105'; if (mode === 'expired') clock = 200; }
        async submitTask() { submits++; return { taskId }; }
        async attest(params) { received = params; return mode === 'empty' ? [] : [{ ...await committedAttestation(), taskId: mode === 'wrong-task' ? '0x' + 'cd'.repeat(32) : taskId }]; }
        async verifyAndPollTaskResult() { return mode === 'empty-result' ? [] : [{ verified: true }]; }
        getAllJsonResponse() { return JSON.stringify([{ id: 'binance-response-0', content: '{"data":{"volume":"123.45"}}' }]); }
      }
      const flow = runPrimusNetworkProof({ expectedAddress: address, additionParams: 'nonce-binding', expiresAt: 150, collectRawResponse: true }, { loadSdk: async () => ({ PrimusNetwork: Network }), now: () => clock });
      if (mode === 'valid') {
        const result = await flow; assert.equal(result.task.taskId, taskId); assert.equal(received.additionParams, 'nonce-binding'); assert.equal(received.allJsonResponseFlag, 'true');
        const dvcRequest = await prepareDvcRequest(result);
        assert.equal(dvcRequest.verification_type, 'HASH_COMPARSION');
        assert.equal(dvcRequest.public_data, result.attestation);
        assert.deepEqual(dvcRequest.private_data.plain_json_response, [{ id: 'binance-response-0', content: '{"data":{"volume":"123.45"}}' }]);
      } else {
        await assert.rejects(flow, mode === 'chain-change' ? /network changed/ : mode === 'expired' ? /expired/ : mode === 'empty-result' ? /no verified task results/ : /matching attestation/);
        if (mode === 'chain-change' || mode === 'expired') assert.equal(submits, 0);
      }
    }
  } finally { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; }
});

test('DVC request preparation rejects missing or malformed private response', async () => {
  await assert.rejects(prepareDvcRequest({ attestation: [], rawJsonResponse: '{}' }), /attestation/);
  await assert.rejects(prepareDvcRequest({ attestation: [{}], rawJsonResponse: 'not-json' }), /unreadable/);
  await assert.rejects(prepareDvcRequest({ attestation: [{}], rawJsonResponse: '{}' }), /array of/);
});

test('DVC export rejects plaintext, missing commitments and tampered response bodies', async () => {
  const attestation = [await committedAttestation()];
  await assert.rejects(prepareDvcRequest({ attestation: [{ attestation: { data: '{"volume":"123.45"}' } }], rawJsonResponse: [privateResponse] }), /full-response SHA-256/);
  await assert.rejects(prepareDvcRequest({ attestation, rawJsonResponse: [{ ...privateResponse, id: 'other' }] }), /full-response SHA-256/);
  await assert.rejects(prepareDvcRequest({ attestation, rawJsonResponse: [{ ...privateResponse, content: '{"data":{"volume":"999999"}}' }] }), /does not match/);
  await assert.rejects(prepareDvcRequest({ attestation: [...attestation, ...attestation], rawJsonResponse: [privateResponse] }), /Exactly one/);
});

test('ordinary source verification never requests or retrieves the complete private response', async () => {
  const oldWindow = globalThis.window;
  try {
    globalThis.window = { ethereum: { async request({ method }) { return method === 'eth_chainId' ? '0x14a34' : [address]; } } };
    class Network {
      async init() {}
      async submitTask() { return { taskId }; }
      async attest(params) { assert.equal(params.allJsonResponseFlag, undefined); return [{ taskId }]; }
      async verifyAndPollTaskResult() { return [{ verified: true }]; }
      getAllJsonResponse() { assert.fail('private response must not be retrieved'); }
    }
    const result = await runPrimusNetworkProof({}, { loadSdk: async () => ({ PrimusNetwork: Network }) });
    assert.equal(result.rawJsonResponse, undefined);
  } finally { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; }
});
