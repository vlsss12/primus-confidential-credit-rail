export function canonicalizePolicy(value) {
  const sort = (item) => Array.isArray(item)
    ? item.map(sort)
    : item && typeof item === 'object'
      ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])]))
      : item;
  return JSON.stringify(sort(value));
}

export async function verifyCompiledPolicy(policy, subtle = globalThis.crypto?.subtle) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy) || policy.schema !== 'primus-credit-gate-policy/v1') {
    throw new Error('Choose a compiled Credit Gate policy JSON.');
  }
  if (typeof policy.policyHash !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(policy.policyHash)) {
    throw new Error('The policy is missing a valid SHA-256 commitment.');
  }
  if (typeof policy.name !== 'string' || !policy.name.trim() || !/^\d+\.\d+\.\d+$/.test(policy.version ?? '') ||
      !Number.isSafeInteger(policy.rule?.threshold) || policy.rule.threshold < 0 ||
      !Number.isSafeInteger(policy.binding?.chainId) || !Number.isSafeInteger(policy.binding?.expiresInSeconds)) {
    throw new Error('The policy fields are incomplete or invalid. Recompile it in Credit Gate.');
  }
  if (!subtle) throw new Error('Secure-context Web Crypto is required to verify the policy hash.');
  const { policyHash, ...unsignedPolicy } = policy;
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(canonicalizePolicy(unsignedPolicy)));
  const actual = `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  if (actual !== policyHash) throw new Error('Policy hash mismatch. The file may have been changed after compilation.');
  return policy;
}
