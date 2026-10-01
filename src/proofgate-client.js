import { runPrimusNetworkProof, BINANCE_KYC_STATUS_TEMPLATE_ID } from './primus-network.js';
import { assertWallet, signingMessage, apiRequest } from './proofgate-protocol.js';

// Injectable services test the flow without wallet prompts or transactions.
export function createProofGateClient({ getProvider = () => globalThis.window?.ethereum,
  post = apiRequest, runProof = runPrimusNetworkProof,
  now = () => Math.floor(Date.now() / 1000), sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  origin = () => globalThis.location?.origin } = {}) {
  let busy = false;
  return async function requestSourceReceipt({ audience = 'credit-rail', onStatus = () => {} } = {}) {
    if (busy) throw new Error('A proof request is already running. Wait for it to finish.');
    busy = true;
    try {
      const provider = getProvider();
      if (!provider) throw new Error('Install an EVM wallet and the Primus Extension first.');
      if (parseInt(await provider.request({ method: 'eth_chainId' }), 16) !== 84532) throw new Error('Switch your wallet to Base Sepolia (84532).');
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const wallet = accounts?.[0];
      if (!/^0x[a-fA-F0-9]{40}$/.test(wallet || '')) throw new Error('No valid wallet account was returned.');
      await assertWallet(provider, wallet, 84532);
      onStatus('Creating a wallet-bound request…');
      const c = await post({ action: 'challenge', wallet, audience });
      if (c.origin !== origin() || c.audience !== audience || c.wallet?.toLowerCase() !== wallet.toLowerCase() || c.chainId !== 84532 || c.templateId !== BINANCE_KYC_STATUS_TEMPLATE_ID || typeof c.challenge !== 'string' || typeof c.additionParams !== 'string' || !/^[a-f0-9]{48}$/.test(c.nonce) || !Number.isSafeInteger(c.expiresAt) || c.expiresAt <= now()) throw new Error('Invalid or expired server challenge. No proof submitted.');
      const checkExpiry = () => { if (now() >= c.expiresAt) throw new Error('Request expired. No receipt confirmed. Check your existing task before starting again.'); };
      await assertWallet(provider, wallet, 84532);
      const proof = await runProof({ templateId: c.templateId, chainId: c.chainId, additionParams: c.additionParams, expectedAddress: wallet, expiresAt: c.expiresAt, onStatus });
      const taskId = proof?.task?.taskId;
      if (!/^0x[a-fA-F0-9]{64}$/.test(taskId || '')) throw new Error('No valid Primus task was returned.');
      await assertWallet(provider, wallet, 84532); checkExpiry();
      onStatus('Sign the request binding — this is not a transfer…');
      const bytes = new TextEncoder().encode(signingMessage(c, taskId));
      const hex = '0x' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      const signature = await provider.request({ method: 'personal_sign', params: [hex, c.wallet] });
      await assertWallet(provider, wallet, 84532); checkExpiry();
      const payload = { action: 'verify', challenge: c.challenge, taskId, signature };
      // Retry only explicit unconfirmed state, not an ambiguous timeout after
      // nonce consumption. Never submit a second task while waiting for blocks.
      for (let attempt = 0; attempt < 8; attempt++) {
        await assertWallet(provider, wallet, 84532); checkExpiry();
        onStatus(attempt ? 'Waiting for confirmed blocks — no new proof transaction is submitted…' : 'Checking confirmed Primus contract state on the server…');
        try {
          const result = await post(payload);
          if (result.verified !== true || result.receipt?.wallet?.toLowerCase() !== wallet.toLowerCase() || result.receipt?.taskId !== taskId || result.receipt?.audience !== audience || result.receipt?.scope !== 'source-attestation-only') throw new Error('Invalid verification receipt.');
          return result;
        } catch (error) {
          if (error.status !== 425 || attempt === 7) throw error;
          await sleep(4000);
        }
      }
    } finally { busy = false; }
  };
}
export const requestSourceReceipt = createProofGateClient();
