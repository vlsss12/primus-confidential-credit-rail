export default function handler(_req, res) {
  res.setHeader('Cache-Control', 'no-store');
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
