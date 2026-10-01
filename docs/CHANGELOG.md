# Changelog

## 2026-10-02 — ProofGate verification prototype

- Added a Base Sepolia source-attestation verifier and dedicated `/proofgate.html` interface.
- Bound verification requests to a wallet, origin, consumer, template and 15-minute expiry.
- Added server-side verification of confirmed Primus task state, atomic Redis replay protection and shared rate limiting.
- Added exact wallet signing messages, bounded verification retries and wallet/network-change checks.
- Pinned Network-JS-SDK to 0.1.11 and added 40 fixture-based automated tests.
- Configured durable Redis in the production environment and demonstrated challenge issuance without a wallet transaction.
- Clarified that source attestation is not KYC approval, credit eligibility, zkFHE computation, official endorsement or reward eligibility.

### Validation and remaining work

Automated tests and static smoke checks pass. A real owner-authorized attestation, receipt issuance and live replay rejection remain pending. See [live validation record](LIVE_TEST_RECORD.md).

Official SDK transitive dependencies still require advisory review. The free Redis plan is suitable for this limited prototype, not an assertion of production SLA or full security certification. Credentials are server-only and are not part of this release.
