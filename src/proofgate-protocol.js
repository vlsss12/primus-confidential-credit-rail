// Shared verbatim between browser and verifier to prevent signing drift.
export function signingMessage(c, taskId) {
  return `ProofGate verification\nOrigin: ${c.origin}\nAudience: ${c.audience}\nWallet: ${c.wallet}\nChain: ${c.chainId}\nTemplate: ${c.templateId}\nTask: ${taskId}\nNonce: ${c.nonce}\nExpires: ${c.expiresAt}\nScope: source-attestation-only; no credit or KYC approval`;
}
export async function assertWallet(provider, address, chainId) {
  const chain = Number.parseInt(await provider.request({ method: 'eth_chainId' }), 16);
  if (chain !== Number(chainId)) throw new Error(`Wallet network changed. Switch to chain ${chainId} and start again.`);
  const accounts = await provider.request({ method: 'eth_accounts' });
  if (!address || accounts?.[0]?.toLowerCase() !== address.toLowerCase()) throw new Error('Wallet changed or disconnected. Start a new request.');
}
export async function apiRequest(body, { fetchFn = globalThis.fetch, timeoutMs = 15000 } = {}) {
  let response;
  try {
    response = await fetchFn('/api/proofgate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new Error('The server request timed out or the connection was lost. No receipt confirmed; check your existing task before starting another proof.');
  }
  let data;
  try { data = await response.json(); } catch { throw new Error('The server returned an unreadable response. No receipt confirmed.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid server response. No receipt confirmed.');
  if (!response.ok) {
    const error = new Error(typeof data.error === 'string' ? data.error : 'Server verification failed.');
    error.status = response.status;
    throw error;
  }
  return data;
}
