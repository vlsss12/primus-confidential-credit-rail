/**
 * Primus Network-JS-SDK adapter.
 *
 * Published Primus template used for the first real integration path.
 * Template IDs are public configuration; app secrets are never stored here.
 */
import { assertWallet } from './proofgate-protocol.js';
export const BINANCE_SPOT_30D_VOLUME_TEMPLATE_ID =
  'ad7d29c8-d820-495a-8bf1-02b8f236a1ae';
export const BINANCE_KYC_STATUS_TEMPLATE_ID =
  '9859330b-b94f-47a4-8f13-0ca56dabe273';

export async function runPrimusNetworkProof({
  templateId = BINANCE_SPOT_30D_VOLUME_TEMPLATE_ID,
  chainId = 84532,
  additionParams,
  expectedAddress,
  expiresAt,
  onStatus = () => {},
}, { loadSdk = () => import('@primuslabs/network-js-sdk'), now = () => Math.floor(Date.now() / 1000) } = {}) {
  const checkExpiry = () => {
    if (expiresAt !== undefined && (!Number.isSafeInteger(expiresAt) || now() >= expiresAt)) throw new Error('Request expired. No further proof operation submitted.');
  };
  checkExpiry();
  if (!templateId || templateId === 'YOUR_APPROVED_TEMPLATE_ID') {
    throw new Error('An approved Primus Template ID is required.');
  }

  if (!window.ethereum) {
    throw new Error('Install the Primus Extension and connect an EVM wallet.');
  }

  const { PrimusNetwork } = await loadSdk();
  const provider = window.ethereum;
  const currentChainId = Number.parseInt(
    await provider.request({ method: 'eth_chainId' }),
    16,
  );
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  const address = accounts?.[0];

  if (!address) throw new Error('No wallet address was returned.');
  if (expectedAddress && address.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new Error('Wallet changed. Start a new request.');
  }
  if (![84532, 8453].includes(Number(chainId))) {
    throw new Error('Use Base Sepolia (84532) or Base mainnet (8453).');
  }
  if (currentChainId !== Number(chainId)) {
    throw new Error(`Switch your wallet to chain ${chainId} before starting.`);
  }

  const primusNetwork = new PrimusNetwork();
  onStatus('Initializing Primus Network SDK…');
  await primusNetwork.init(provider, Number(chainId));

  const taskParams = { templateId, address };
  await assertWallet(provider, address, chainId);
  checkExpiry();
  onStatus('Submitting attestation task…');
  const task = await primusNetwork.submitTask(taskParams);
  if (!task || !/^0x[a-fA-F0-9]{64}$/.test(task.taskId)) throw new Error('Primus did not return a valid task. Check the wallet transaction before retrying.');
  await assertWallet(provider, address, chainId);
  checkExpiry();

  onStatus('Waiting for the Primus attestor…');
  const attestation = await primusNetwork.attest({
    ...taskParams,
    ...task,
    allJsonResponseFlag: 'true',
    ...(additionParams ? { additionParams } : {}),
  });

  if (!Array.isArray(attestation) || !attestation.length || attestation[0]?.taskId?.toLowerCase() !== task.taskId.toLowerCase()) {
    throw new Error('Primus returned no matching attestation. Check the existing task before retrying.');
  }
  onStatus('Verifying the attestation…');
  const result = await primusNetwork.verifyAndPollTaskResult({
    taskId: attestation[0].taskId,
    reportTxHash: attestation[0].reportTxHash,
  });
  if (!Array.isArray(result) || result.length === 0) {
    throw new Error('Primus returned no verified task results. The attestation cannot be treated as successful.');
  }

  // This response may contain private exchange data. Keep it in memory only;
  // callers must explicitly choose any export or onward transmission.
  const rawJsonResponse = primusNetwork.getAllJsonResponse?.(task.taskId);
  return { address, task, attestation, result, rawJsonResponse };
}

/** Build the documented DVC request envelope without sending or persisting it. */
export function prepareDvcRequest({ attestation, rawJsonResponse }) {
  if (!Array.isArray(attestation) || attestation.length === 0) {
    throw new Error('A verified Primus attestation is required before preparing DVC input.');
  }
  if (rawJsonResponse === undefined || rawJsonResponse === null || rawJsonResponse.length === 0) {
    throw new Error('Primus did not expose the raw JSON response for this task.');
  }
  let parsed = rawJsonResponse;
  if (typeof rawJsonResponse === 'string') {
    try { parsed = JSON.parse(rawJsonResponse); } catch {
      throw new Error('Primus returned an unreadable raw JSON response.');
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((item) =>
    !item || typeof item.id !== 'string' || typeof item.content !== 'string'
  )) throw new Error('Primus raw response must be an array of {id, content} records.');
  return {
    // The pinned official verifier crate uses this legacy misspelling.
    // Keep this aligned with DVC-Demo's testdata until Primus fixes the schema.
    verification_type: 'HASH_COMPARSION',
    public_data: attestation,
    private_data: { plain_json_response: parsed },
  };
}
