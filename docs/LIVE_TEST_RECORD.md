# ProofGate live validation record — VLS

## Verified on 2026-10-02

- `npm test`: 40 passed, 0 failed. Tests use fixtures and do not prove live SDK success.
- `npm run smoke`: passed (static product/security markers).
- Before Redis setup, the public API reported `ready: false`. After configuring server-only Redis secrets and deployment `dpl_GqKH63wyPQbWwutS58MD85ig5Bsk`, it reported HTTP 200, `ready: true`, chain `84532`, scope `source-attestation-only`.
- A same-origin challenge request with a synthetic address returned HTTP 200. This exercised the Redis-backed rate limiter without a wallet signature or blockchain transaction. Nonce consumption with a real proof remains untested.
- Live user-authorized attestation: **not performed**.
- Receipt/replay test with a real task: **not performed**.

## Blocking configuration

Server configuration is present and Redis-backed challenge issuance succeeded. The remaining blocker is an owner-operated wallet/extension proof and receipt/replay validation. Never disable binding or nonce checks to make the demo work. Do not publish credentials in this record.

## Owner-operated test

1. Configure Redis REST URL/write token in Vercel and redeploy. Public readiness checks configuration presence only, not connectivity.
2. Open `/proofgate.html`, use Base Sepolia and explicitly consent to the test transaction. Authenticate with your own provider session in the Primus Extension. Never send passwords or private keys to the application or team.
3. Submit only one task. If a transaction may already exist, inspect it before retrying; do not create repeated tasks just to get a successful UI state.
4. Complete the wallet signature and verification. Record the test time, chain, task ID and HTTP outcome privately. Share wallet-linked identifiers only with explicit owner consent.
5. Confirm the server issues a receipt only when task status, assigned attestors, recipient, template, freshness and exact request binding pass. Missing `additionParams` must be rejected, not bypassed.
6. Re-submit the exact same signed verification request: expect HTTP 409. A changed audience or wallet must be rejected. Do not publish the signature or challenge payload.

## Acceptance before team review

- [x] Production configuration present; Redis-backed challenge issuance demonstrated. RPC contract read still needs live-flow validation.
- [ ] One live task completed with owner consent.
- [ ] Exact request binding survives the SDK/extension/onchain flow.
- [ ] Server receipt and replay rejection demonstrated.
- [ ] Evidence sanitized; no credentials or personal attestation contents included.

Until all checks pass, describe the project as an implemented zkTLS verification prototype awaiting live validation, not a production-approved integration, KYC approval system, zkFHE application or reward-qualified contribution.
