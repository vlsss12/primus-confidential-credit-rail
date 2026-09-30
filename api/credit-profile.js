export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'HEAD') return res.status(200).end();

  res.status(200).json({
    source: 'primus-confidential-credit-rail-demo',
    demo: true,
    credit_profile: {
      volume_band: 'institutional',
      collateral_ratio: 184.6,
      kyc_status: 'verified',
      attestation_scope: 'synthetic-demo-only'
    },
    notice: 'Synthetic demonstration data. Not a Primus attestation.'
  });
}
