# Changelog

## 2026-11-08 — Integration hardening and review evidence

- Unified Network SDK loading on the locked 0.1.11 release and removed duplicate browser handlers.
- Added an independent build-time DVC attestor trust anchor; missing configuration rejects all inputs.
- Required complete-response SHA-256 commitment matching before a private DVC export is available.
- Stopped requesting complete private responses for ordinary source/KYC verification.
- Recorded the tutorial comparison, current test/build evidence and public upstream contribution status.
- Clarified UI labels for source-only KYC verification, local response handling and unconnected business-verification stages.
- Published reproducible contributor instructions, a documentation index and a live CI badge.
- Kept personal correspondence outside the current repository contents.

Validation: 51 JavaScript tests, 12 Rust core tests and smoke checks passed. Live owner receipt/replay, compatible DVC template/trust setup and program recognition remain pending. See [validation](INTEGRATION_VALIDATION_2026-11-08.md).

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
