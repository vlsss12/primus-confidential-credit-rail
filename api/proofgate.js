import { GateError, settings, issueChallenge, verifySubmission, rateLimit, AUDIENCES, TEMPLATE } from '../lib/proofgate.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'GET') {
    let ready = true;
    try { settings(); } catch { ready = false; }
    return res.status(200).json({ ready, chainId: 84532, templateId: TEMPLATE, audiences: AUDIENCES, scope: 'source-attestation-only' });
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  try {
    const config = settings();
    if (req.headers.origin !== config.origin) throw new GateError('Use the configured ProofGate website.', 403);
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new GateError('JSON required.', 415);
    let body = req.body;
    if (typeof body === 'string') {
      if (Buffer.byteLength(body) > 8192) throw new GateError('Request too large.', 413);
      try { body = JSON.parse(body); } catch { throw new GateError('Malformed JSON.'); }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new GateError('Invalid request.');
    if (Buffer.byteLength(JSON.stringify(body)) > 8192) throw new GateError('Request too large.', 413);
    if (!['challenge', 'verify'].includes(body.action)) throw new GateError('Unknown action.');
    if (body.action === 'challenge' && (typeof body.wallet !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(body.wallet) || !AUDIENCES.includes(body.audience))) throw new GateError('Invalid wallet or consumer.');
    await rateLimit(req, config);
    if (body.action === 'challenge') return res.status(200).json(issueChallenge(body.wallet, body.audience, config));
    if (body.action === 'verify') return res.status(200).json(await verifySubmission(body, config));
    throw new GateError('Unknown action.');
  } catch (error) {
    const status = error instanceof GateError ? error.status : 503;
    if (status === 425) res.setHeader('Retry-After', '4');
    if (status === 429) res.setHeader('Retry-After', '60');
    return res.status(status).json({ error: error instanceof GateError ? error.message : 'Verification unavailable. No receipt issued. Please retry later.' });
  }
}
