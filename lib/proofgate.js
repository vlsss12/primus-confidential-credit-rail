import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Contract, FetchRequest, JsonRpcProvider, getAddress, verifyMessage } from 'ethers';
import { signingMessage } from '../src/proofgate-protocol.js';
export { signingMessage } from '../src/proofgate-protocol.js';

export const CONTRACT = '0xC02234058caEaA9416506eABf6Ef3122fCA939E8';
export const TEMPLATE = '9859330b-b94f-47a4-8f13-0ca56dabe273';
export const AUDIENCES = ['credit-rail', 'partner-preview'];
const TTL = 900;
export const TASK_ABI = ['function queryTask(bytes32 taskId) view returns (tuple(string templateId,address submitter,address[] attestors,tuple(address attestor,bytes32 taskId,tuple(address recipient,tuple(string url,string header,string method,string body)[] request,tuple(tuple(string keyName,string parseType,string parsePath)[] oneUrlResponseResolve)[] responseResolve,string data,string attConditions,uint64 timestamp,string additionParams) attestation)[] taskResults,uint64 submittedAt,uint8 tokenSymbol,address callback,uint8 taskStatus) taskInfo)'];

export class GateError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function settings(env = process.env) {
  const secret = env.PROOFGATE_SECRET;
  const origin = env.PROOFGATE_ORIGIN;
  const rpc = env.PROOFGATE_RPC_URL;
  const redis = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!secret || Buffer.byteLength(secret) < 32 || !origin || !rpc || !redis || !token) {
    throw new GateError('ProofGate needs server configuration. See docs/PROOFGATE.md.', 503);
  }
  for (const url of [origin, rpc, redis]) {
    let parsed;
    try { parsed = new URL(url); } catch { throw new GateError('Invalid server configuration.', 503); }
    if (parsed.username || parsed.password) throw new GateError('Invalid server configuration.', 503);
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) {
      throw new GateError('Invalid server configuration.', 503);
    }
  }
  if (new URL(origin).origin !== origin) throw new GateError('Configure an exact site origin without a trailing slash.', 503);
  return { secret, origin, rpc, redis, token };
}
function mac(payload, secret) {
  return createHmac('sha256', secret).update(`proofgate.challenge.v1.${payload}`).digest('base64url');
}
export function encodeChallenge(claims, secret) {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${mac(payload, secret)}`;
}
export function decodeChallenge(token, config, now = Math.floor(Date.now() / 1000)) {
  if (typeof token !== 'string' || token.length > 2048) throw new GateError('Invalid challenge.');
  const parts = token.split('.');
  if (parts.length !== 2) throw new GateError('Invalid challenge.');
  const expected = Buffer.from(mac(parts[0], config.secret));
  const supplied = Buffer.from(parts[1]);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new GateError('Invalid challenge signature.');
  let c;
  try { c = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); } catch { throw new GateError('Invalid challenge.'); }
  if (!c || typeof c !== 'object' || Array.isArray(c)) throw new GateError('Invalid challenge.');
  if (c.version !== 1 || c.origin !== config.origin || !AUDIENCES.includes(c.audience) || c.chainId !== 84532 || c.templateId !== TEMPLATE || !/^[a-f0-9]{48}$/.test(c.nonce) || !Number.isSafeInteger(c.issuedAt) || c.issuedAt > now || c.expiresAt !== c.issuedAt + TTL || c.expiresAt <= now) {
    throw new GateError('Challenge expired or does not belong to this application.');
  }
  try { if (getAddress(c.wallet) !== c.wallet) throw new Error(); } catch { throw new GateError('Invalid challenge wallet.'); }
  return c;
}
export function binding(c) {
  return JSON.stringify({ proofgate: 1, origin: c.origin, audience: c.audience, nonce: c.nonce });
}
export function issueChallenge(wallet, audience, config, now = Math.floor(Date.now() / 1000)) {
  if (!AUDIENCES.includes(audience)) throw new GateError('Unknown consumer.');
  let address;
  try { address = getAddress(wallet); } catch { throw new GateError('Enter a valid wallet address.'); }
  const claims = { version: 1, origin: config.origin, audience, wallet: address, chainId: 84532, templateId: TEMPLATE, nonce: randomBytes(24).toString('hex'), issuedAt: now, expiresAt: now + TTL };
  return { challenge: encodeChallenge(claims, config.secret), ...claims, additionParams: binding(claims) };
}
export function validateTask(task, c, taskId, now) {
  if (!task || !Number.isInteger(Number(task.taskStatus))) throw new GateError('Invalid contract response.', 503);
  if (Number(task.taskStatus) === 0) throw new GateError('Waiting for confirmed Primus task state. Keep this request open.', 425);
  if (Number(task.taskStatus) !== 1) throw new GateError('Task is not fully successful.', 422);
  if (typeof task.submitter !== 'string' || !Array.isArray(task.attestors) || !Array.isArray(task.taskResults)) throw new GateError('Invalid contract response.', 503);
  if (task.templateId !== c.templateId || task.submitter.toLowerCase() !== c.wallet.toLowerCase()) throw new GateError('Task template or wallet mismatch.', 422);
  const submittedAt = Number(task.submittedAt);
  if (!Number.isSafeInteger(submittedAt) || submittedAt < c.issuedAt || submittedAt > now) throw new GateError('Task is outside this request window.', 422);
  if (!task.attestors?.length || task.taskResults?.length !== task.attestors.length) throw new GateError('Incomplete attestor results.', 422);
  const assigned = new Set(task.attestors.map(a => a.toLowerCase()));
  const seen = new Set();
  for (const result of task.taskResults) {
    if (!result || typeof result.attestor !== 'string' || typeof result.taskId !== 'string' || typeof result.attestation?.recipient !== 'string') throw new GateError('Invalid attestor response.', 503);
    const attestor = result.attestor.toLowerCase();
    if (!assigned.has(attestor) || seen.has(attestor) || result.taskId.toLowerCase() !== taskId.toLowerCase() || result.attestation.recipient.toLowerCase() !== c.wallet.toLowerCase() || result.attestation.additionParams !== binding(c)) {
      throw new GateError('Attestation does not bind to this request.', 422);
    }
    seen.add(attestor);
  }
  // Deliberately do NOT interpret attestation.data as a KYC or financial decision.
  return { scope: 'source-attestation-only', chainId: c.chainId, contract: CONTRACT, templateId: c.templateId, wallet: c.wallet, taskId, audience: c.audience, verifiedAt: now, expiresAt: c.expiresAt };
}
export async function readTask(taskId, config) {
  const connection = new FetchRequest(config.rpc);
  connection.timeout = 10000;
  const provider = new JsonRpcProvider(connection);
  try {
    if (Number((await provider.getNetwork()).chainId) !== 84532) throw new GateError('Server RPC must use Base Sepolia.', 503);
    const block = await provider.getBlockNumber();
    if (block < 3) throw new GateError('Network is not ready.', 503);
    // Read a confirmed snapshot, not an unconfirmed browser-provided result.
    return await new Contract(CONTRACT, TASK_ABI, provider).queryTask(taskId, { blockTag: block - 2 });
  } finally { provider.destroy(); }
}
export async function consumeNonce(c, config, now) {
  const response = await fetch(config.redis, {
    method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['SET', `proofgate:v1:${c.nonce}`, 'used', 'NX', 'EX', Math.max(1, c.expiresAt - now)]),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new GateError('Replay protection unavailable. No receipt issued.', 503);
  const data = await response.json();
  if (data.error) throw new GateError('Replay protection unavailable. No receipt issued.', 503);
  if (data.result === null) throw new GateError('This request has already been consumed.', 409);
  if (data.result !== 'OK') throw new GateError('Replay protection unavailable. No receipt issued.', 503);
}
export async function rateLimit(req, config) {
  // Vercel overwrites x-real-ip. Hash it; never store IPs or wallet addresses.
  // Local requests share one bucket. Do not deploy behind an untrusted proxy.
  const address = String(req.headers['x-real-ip'] || 'local');
  const key = createHmac('sha256', config.secret).update(address).digest('hex');
  const response = await fetch(config.redis, {
    method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['EVAL', "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n", '1', `proofgate:rate:${key}`]),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new GateError('Request protection unavailable.', 503);
  const data = await response.json();
  if (!Number.isInteger(data.result) || data.result < 1) throw new GateError('Request protection unavailable.', 503);
  if (data.result > 12) throw new GateError('Too many requests. Retry in one minute.', 429);
}
export async function verifySubmission(body, config, { read = readTask, consume = consumeNonce, now = () => Math.floor(Date.now() / 1000) } = {}) {
  const c = decodeChallenge(body.challenge, config, now());
  if (typeof body.taskId !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(body.taskId) || typeof body.signature !== 'string' || !/^0x[a-fA-F0-9]{130}$/.test(body.signature)) throw new GateError('Invalid task or wallet signature.');
  let recovered;
  try { recovered = verifyMessage(signingMessage(c, body.taskId), body.signature); } catch { throw new GateError('Invalid wallet signature.'); }
  if (recovered.toLowerCase() !== c.wallet.toLowerCase()) throw new GateError('Wallet signature does not match this request.');
  const task = await read(body.taskId, config);
  // Check expiry again after potentially slow RPC calls.
  decodeChallenge(body.challenge, config, now());
  const receipt = validateTask(task, c, body.taskId, now());
  await consume(c, config, now());
  decodeChallenge(body.challenge, config, now());
  return { verified: true, receipt, notice: 'Successful source attestation only. This is not KYC approval, credit eligibility, a Primus endorsement, or an access token.' };
}
