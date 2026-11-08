# Builder review packet

Updated 2026-11-08. Owner: VLS, GitHub `vlsss12`, X `vlsss12`.

## Project and review scope

- Project: Primus Confidential Credit Rail.
- Repository: https://github.com/vlsss12/primus-confidential-credit-rail
- Demo: https://primus-credit-rail.vercel.app/
- First review target: https://primus-credit-rail.vercel.app/proofgate.html
- Developer Hub project ID: `2104955239034523648`.
- Public App ID: `0x4038de97cf9c004d3f9890f5668b318230cc2e38`.

Credit Rail is an independent community implementation exploring narrow, verifiable financial claims. Its current server verifier checks source-attestation provenance; it does not approve KYC, grant credit or execute a lending decision. Synthetic policy tools and the DVC guest are separate from that verifier.

## Integration path

The current application uses `@primuslabs/network-js-sdk@0.1.11`, the official Network path: `init → submitTask → attest → verifyAndPollTaskResult`. Browser and server ABI checks use that exact installed release.

The Developer Hub tutorial also demonstrates `@primuslabs/zktls-js-sdk`, an Enterprise path with an App ID and server-side request signing. We registered a Hub project, but our Network integration does not use that Enterprise Secret or claim App-ID-attributed usage. Please confirm how Network SDK applications should associate usage with a Hub project for contributor review. See [tutorial alignment](TUTORIAL_ALIGNMENT.md).

Published templates selected from the Hub:

| Purpose | Template | Current boundary |
| --- | --- | --- |
| Binance 30-day spot volume | `ad7d29c8-d820-495a-8bf1-02b8f236a1ae` | Source attestation; raw response export requires a matching full-response commitment |
| Binance KYC status | `9859330b-b94f-47a4-8f13-0ca56dabe273` | Source attestation only; a successful task is not positive KYC approval |

ProofGate uses Base Sepolia (`84532`), the official TaskManager at `0xC02234058caEaA9416506eABf6Ef3122fCA939E8`, confirmed task state, exact wallet/template/audience/request binding, and a durable Redis nonce.

## Evidence and remaining acceptance

- 51 JavaScript tests passed, including SDK pinning, wallet/chain/expiry guards, request bindings, fixture receipt/replay cases, and DVC response-commitment checks.
- 12 Rust core tests passed. The changed SP1 guest compiled; the recorded unconfigured ELF rejects all inputs until an independent trusted signer is embedded.
- Smoke check passed. Automated tests do not demonstrate a real owner attestation.
- Production reported server configuration present. The browser check stopped before a transaction because the wallet was not on Base Sepolia.
- A real owner-authorized task, receipt and identical-request replay rejection remain pending.
- A compatible full-response-hash template/response, independently approved DVC signer and relying verifier setup remain pending. The existing field-level volume template must not be assumed DVC-compatible.

Detailed evidence: [integration validation](INTEGRATION_VALIDATION_2026-11-08.md), [live acceptance](LIVE_TEST_RECORD.md), [DVC implementation](DVC_IMPLEMENTATION.md), [contribution ledger](CONTRIBUTION_LEDGER.md).

## Privacy boundary

No wallet private key, recovery phrase, Binance password or exchange API key is requested by this application. ProofGate does not accept raw attestation bodies. Ordinary source verification does not request the complete private HTTP response. The optional volume flow can hold it locally for DVC preparation; the explicit downloaded file is sensitive. Primus, its extension, attestors and onchain data have their own disclosure properties.

## Review requested from Primus

1. Confirm the recommended way to associate this Network SDK application with the registered Hub project.
2. Review the selected templates and exact request-binding/server verification approach.
3. Confirm the supported whole-response hash template/schema and attestor trust source for DVC.
4. Point us to the current Builder contribution review or developer incentive application, including required milestones and evidence.
5. Confirm whether reviewed integrations and accepted upstream PRs are recognized through Community XP, another developer program, or a separate grant process.

## Incentive interpretation

The [Foundation tokenomics](https://docs.primusfoundation.xyz/docs/tokenomics#allocation-breakdown), retrieved 2026-11-08, describes a Community allocation of 18% supporting developer adoption and community initiatives. This is a budget category, not an award to this project or an application procedure. It also lists Ecosystem and Airdrop & Community Distribution separately. No individual Builder allocation, XP conversion rate, automatic Hub-registration reward, or acceptance for this project is established by that page.

Do not mark recognition or rewards as approved without a published applicable rule or a recorded team decision. We are requesting a technical and program review, not claiming eligibility or an official partnership.
