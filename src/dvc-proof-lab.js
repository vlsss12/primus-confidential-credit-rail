import { verifyCompiledPolicy } from './credit-gate-policy.js';

export const DVC_LAB_SCENARIOS = [
  { id: 'eligible', label: 'Eligible sample', description: 'Valid synthetic source claim above the configured threshold.' },
  { id: 'below-threshold', label: 'Below threshold', description: 'Valid synthetic claim that should produce an ineligible result.' },
  { id: 'tampered-policy', label: 'Tampered policy', description: 'Policy content is changed without updating its commitment.' },
  { id: 'wrong-subject', label: 'Wrong subject', description: 'The claim recipient does not match the bound subject.' },
  { id: 'expired', label: 'Expired claim', description: 'The signed claim is outside its policy validity window.' },
  { id: 'wrong-source', label: 'Wrong source', description: 'The claim uses a different template or source path.' },
  { id: 'wrong-chain', label: 'Wrong chain', description: 'The claim is bound to a different target chain.' },
  { id: 'invalid-decimal', label: 'Invalid precision', description: 'The value exceeds the supported eight decimal places.' },
];

const TEMPLATE_ID = 'ad7d29c8-d820-495a-8bf1-02b8f236a1ae';
const SOURCE_URL = 'https://www.binance.com/bapi/accounts/v1/private/vip/vip-portal/vip-fee/vip-programs-and-fees';
const JSON_PATH = '$.data.traderProgram.spotTrader.spotVolume30d';
const DEMO_SUBJECT = `0x${'11'.repeat(20)}`;
const SCALE = 100_000_000n;

function parseFixed8(value) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,8})?$/.test(value)) throw new Error('Synthetic claim value is not a valid non-negative decimal.');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(8, '0'));
}

export async function runDvcLabScenario(policy, scenarioId, now = Math.floor(Date.now() / 1000)) {
  const selected = DVC_LAB_SCENARIOS.find(({ id }) => id === scenarioId);
  if (!selected) throw new Error('Unknown DVC Lab scenario.');

  const attestedAt = now - 10;
  const fixture = {
    synthetic: true,
    templateId: TEMPLATE_ID,
    sourceUrl: SOURCE_URL,
    jsonPath: JSON_PATH,
    recipient: DEMO_SUBJECT,
    chainId: scenarioId === 'wrong-chain' ? 1 : policy.binding?.chainId,
    attestedAt,
    volumeUsd: scenarioId === 'below-threshold' ? '250000.00' : scenarioId === 'invalid-decimal' ? '1000000.000000001' : '1250000.00',
  };
  let policyForRun = policy;
  if (scenarioId === 'tampered-policy') policyForRun = { ...policy, rule: { ...policy.rule, threshold: policy.rule.threshold + 1 } };
  if (scenarioId === 'wrong-subject') fixture.recipient = `0x${'22'.repeat(20)}`;
  if (scenarioId === 'expired') fixture.attestedAt = now - policy.binding.expiresInSeconds - 1;
  if (scenarioId === 'wrong-source') fixture.jsonPath = '$.data.unexpected.volume';

  const checks = [
    { id: 'policy', label: 'Policy commitment', state: 'pending', detail: 'Recomputing the canonical SHA-256 digest in this browser.' },
    { id: 'source', label: 'Source and template binding', state: 'pending', detail: 'Comparing the synthetic fixture with the configured Binance template and JSON path.' },
    { id: 'subject', label: 'Subject and chain binding', state: 'pending', detail: 'Checking the demo recipient and policy chain.' },
    { id: 'expiry', label: 'Freshness window', state: 'pending', detail: 'Checking expiry derived from the fixture timestamp.' },
    { id: 'rule', label: 'Private policy evaluation', state: 'pending', detail: 'Applying the threshold to a synthetic USD value using fixed-point arithmetic.' },
  ];
  const finish = (state, publicOutput = null) => ({ scenario: selected, fixture, checks, state, publicOutput, signatureStatus: 'NOT CHECKED · synthetic fixture only' });

  try {
    await verifyCompiledPolicy(policyForRun);
    checks[0].state = 'pass';
    checks[0].detail = 'Canonical SHA-256 matches the policy contents.';
  } catch (error) {
    checks[0].state = 'fail';
    checks[0].detail = error.message;
    for (const check of checks.slice(1)) { check.state = 'skipped'; check.detail = 'Stopped because an earlier integrity check failed.'; }
    return finish('rejected');
  }

  const sourceMatches = fixture.templateId === policy.source?.templateId && fixture.templateId === TEMPLATE_ID && fixture.sourceUrl === SOURCE_URL && fixture.jsonPath === JSON_PATH;
  checks[1].state = sourceMatches ? 'pass' : 'fail';
  checks[1].detail = sourceMatches ? 'Template ID, Binance endpoint and extraction path match the pinned demo configuration.' : 'The fixture source does not match the configured template, endpoint or extraction path.';
  const subjectMatches = /^0x[a-fA-F0-9]{40}$/.test(fixture.recipient) && fixture.recipient.toLowerCase() === DEMO_SUBJECT.toLowerCase() && fixture.chainId === policy.binding?.chainId;
  checks[2].state = subjectMatches ? 'pass' : 'fail';
  checks[2].detail = subjectMatches ? 'Synthetic recipient and chain match the policy binding.' : 'Recipient or chain does not match the policy binding.';
  const expiresAt = fixture.attestedAt + (policy.binding?.expiresInSeconds || 0);
  const fresh = Number.isSafeInteger(expiresAt) && now < expiresAt;
  checks[3].state = fresh ? 'pass' : 'fail';
  checks[3].detail = fresh ? 'Synthetic claim is inside its configured validity window.' : 'Claim is expired or has an invalid expiry.';

  if (!sourceMatches || !subjectMatches || !fresh) {
    checks[4].state = 'skipped';
    checks[4].detail = 'Policy evaluation stopped because a binding or freshness check failed.';
    return finish('rejected');
  }

  let volumeScaled;
  try { volumeScaled = parseFixed8(fixture.volumeUsd); } catch (error) {
    checks[4].state = 'fail'; checks[4].detail = error.message; return finish('rejected');
  }
  const eligible = volumeScaled >= BigInt(policy.rule.threshold) * SCALE;
  checks[4].state = eligible ? 'pass' : 'deny';
  checks[4].detail = eligible ? 'Synthetic value meets the configured minimum.' : 'Synthetic value is below the configured minimum.';
  const publicOutput = {
    policyHash: policy.policyHash,
    eligible,
    chainId: fixture.chainId,
    subject: fixture.recipient.toLowerCase(),
    expiresAt,
  };
  return finish(eligible ? 'eligible' : 'ineligible', publicOutput);
}
