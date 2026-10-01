import test from 'node:test';
import assert from 'node:assert/strict';
import { runPrimusNetworkProof } from '../src/primus-network.js';
const address = '0x' + '11'.repeat(20), taskId = '0x' + 'ab'.repeat(32);
test('adapter blocks chain changes, expiry, empty results and task mismatch', async () => {
  const oldWindow = globalThis.window;
  try {
    for (const mode of ['chain-change', 'expired', 'empty', 'wrong-task', 'valid']) {
      let chain = '0x14a34', clock = 100, submits = 0, received;
      globalThis.window = { ethereum: { async request({ method }) { return method === 'eth_chainId' ? chain : [address]; } } };
      class Network {
        async init() { if (mode === 'chain-change') chain = '0x2105'; if (mode === 'expired') clock = 200; }
        async submitTask() { submits++; return { taskId }; }
        async attest(params) { received = params; return mode === 'empty' ? [] : [{ taskId: mode === 'wrong-task' ? '0x' + 'cd'.repeat(32) : taskId }]; }
        async verifyAndPollTaskResult() { return []; }
      }
      const flow = runPrimusNetworkProof({ expectedAddress: address, additionParams: 'nonce-binding', expiresAt: 150 }, { loadSdk: async () => ({ PrimusNetwork: Network }), now: () => clock });
      if (mode === 'valid') {
        const result = await flow; assert.equal(result.task.taskId, taskId); assert.equal(received.additionParams, 'nonce-binding');
      } else {
        await assert.rejects(flow, mode === 'chain-change' ? /network changed/ : mode === 'expired' ? /expired/ : /matching attestation/);
        if (mode === 'chain-change' || mode === 'expired') assert.equal(submits, 0);
      }
    }
  } finally { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; }
});
