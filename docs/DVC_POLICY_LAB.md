# Credit Gate · DVC Policy Lab

`/credit-gate.html` adds a browser-side policy compiler for the Credit Rail prototype.

## What it does

- Builds a versioned policy for the public Binance 30-day spot-volume template.
- Binds the rule to a chain ID, proof expiry window, subject and disclosure policy.
- Computes SHA-256 over a recursively key-sorted JSON representation of the policy (excluding the resulting `policyHash` field), and exports the policy as JSON.
- States that only the eligibility boolean should be disclosed; exact source values and raw responses are not emitted by the policy file.

The policy hash is a deterministic configuration commitment, not a Primus attestation, zkVM proof, signed receipt, or authorization token. This page does not request wallet access, call Binance, submit a Primus task, or send policy data to a server. The home page has a separate opt-in Network SDK flow.

## Not implemented / prerequisites

The repository now contains a compiled SP1 guest and local-only CPU runner that verifies the Primus attestation before policy execution. A real-attestation run has not yet been tested. The site does not invoke this runner. A deployed DVC path still needs Primus-approved attestor trust configuration, authorized service access and a proof verifier on the target chain with intended replay/expiry controls. Do not represent the local policy digest or an unverified runner result as a production credit decision.

The Binance template identifier is public configuration already used by this project. Verify template suitability and the exact attestation schema with Primus before using it for any real policy. Never put Binance API credentials or wallet private keys in this page or in a public repository.
