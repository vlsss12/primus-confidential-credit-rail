# Primus Confidential Credit Rail

An independent, open-source prototype exploring how DeFi applications can verify narrow eligibility claims without collecting a user's full financial profile. It combines Primus zkTLS source-attestation flows, a request-bound testnet verifier, and a versioned credit-policy workbench.

> **Project status:** community prototype. Credit Gate compiles policy configuration and now includes a locally compiled SP1 guest plus an opt-in local CPU runner. No real attestation has yet been executed/proven end-to-end, and the project does not make a production credit decision. ProofGate verifies source-attestation provenance only and is not a credit/KYC authorization token.

**Live app:** [primus-credit-rail.vercel.app](https://primus-credit-rail.vercel.app/) · **Credit Gate:** [Policy Lab](https://primus-credit-rail.vercel.app/credit-gate.html) · [DVC Proof Lab](https://primus-credit-rail.vercel.app/dvc-proof-lab.html) · **ProofGate:** [Request-bound verifier](https://primus-credit-rail.vercel.app/proofgate.html)

![Status](https://img.shields.io/badge/status-community%20prototype-33c7e8)
![Primus](https://img.shields.io/badge/Primus-zkTLS-ff6b35)
![License](https://img.shields.io/badge/license-MIT-72e6b3)

![Privacy × Verification](assets/primus-privacy-verification-banner.png)

## Product capabilities

### Credit Gate · DVC Policy Lab

- Configure a versioned eligibility rule using the published Binance 30-day spot-volume template.
- Bind the policy to a denomination, target chain, subject requirement, expiry window, and minimal-disclosure output.
- Compile a deterministic policy JSON and calculate its SHA-256 configuration digest in the browser.
- Download the policy manifest for review and future verifier implementation.
- Run a host-tested Rust policy core and an SP1 guest that validates the Primus attestation before applying the policy.
- Use the local-only SP1 CPU runner to execute/prove a downloaded DVC input; it does not upload data or use a hosted prover.
- See the DVC execution prerequisites and current integration status directly in the UI.
- Explore eight deterministic, browser-local conformance scenarios in the [DVC Proof Lab](https://primus-credit-rail.vercel.app/dvc-proof-lab.html#test-kit); download the versioned vectors and a privacy-safe run report. The same vectors are consumed by the Rust core test suite and GitHub Actions. All fixtures are synthetic; no Primus proof is generated.

The policy digest commits to configuration; it is **not** a zk proof, attestation, signed receipt, or authorization. The browser can request a Binance volume attestation through the Primus Network SDK, and the user may explicitly download a file containing the raw response. The site does not upload that file. Do not share it publicly. See [DVC implementation status](docs/DVC_IMPLEMENTATION.md) and [DVC Policy Lab notes](docs/DVC_POLICY_LAB.md).

### ProofGate · request-bound source verification

- Issues a short-lived challenge bound to a wallet, consumer, template, origin, and expiry.
- Verifies a wallet signature and checks the confirmed Primus task state against the expected wallet, template, attestors, recipients, and request binding.
- Consumes the nonce atomically in Redis to reject replayed submissions.
- Fails closed on invalid bindings, expiry, incomplete attestor results, RPC errors, and replay-store failures.
- Returns a minimal informational receipt; it does not grant access or interpret the attestation's financial/KYC data.

ProofGate is Base Sepolia only. It needs server-side configuration; the project still needs a fresh owner-authorized live attestation/receipt and replay validation before claiming full live end-to-end success. Details: [ProofGate design and setup](docs/PROOFGATE.md).

### Primus proof flows and onboarding

- Public Primus BNB ZK ID SDK reference flow, with progress and failure states.
- Network-JS-SDK adapter for the documented task lifecycle (`init → submitTask → attest → verifyAndPollTaskResult`).
- UI entry points for the published Binance 30-day volume and KYC-status templates.
- Railbot getting-started guide on the home page and Credit Gate page.
- Synthetic policy sandbox and downloadable demo JSON, explicitly labeled as illustrative.

The Primus Extension, connected wallet, supported network, and any required testnet gas are user-controlled prerequisites for wallet flows. The app must never ask for a wallet private key, Binance password, or recovery phrase.

## Architecture and boundaries

```text
Primus source attestation ──> ProofGate checks task/request provenance ──> minimal informational receipt

Credit Gate policy form ──> canonical policy JSON + SHA-256 digest
                                      │
                                      └──> Rust policy core + SP1 guest (compiled)
                                                  │
Primus attestation ──> official signature/source/hash verifier ──> local CPU runner (not yet end-to-end tested)
```

The intended application is to verify the Primus attestation inside a DVC program, bind it to the policy digest and request context, compute eligibility privately, then disclose only the required claim. A local guest and CPU runner now exist, but real-attestation execution and proof verification remain untested; Builder deployment and a target-chain verifier still require Primus's approved trust and service setup. See [architecture](docs/ARCHITECTURE.md) and [Builder review packet](docs/BUILDER_REVIEW.md).

**Privacy note:** this project does not submit raw attestation bodies or API credentials to its own ProofGate API. Primus SDK/extension, attestors, and onchain storage have their own disclosure properties; do not assume every attestation field is private.

## Integration status

| Capability | Status |
| --- | --- |
| Public product UI and Railbot guide | Live |
| Synthetic policy sandbox | Implemented; illustrative only |
| Credit Gate policy JSON + SHA-256 digest | Implemented in browser |
| Rust policy evaluator + policy-hash/binding tests | Implemented and host-tested |
| SP1 guest wrapper and RISC-V ELF | Compiled; real-attestation execution pending |
| Local CPU runner | Implemented; runs offline and never selects hosted prover |
| Primus BNB ZK ID flow | Integrated with public test context |
| Network-JS-SDK adapter | Implemented; Base Sepolia/Base chain checks |
| Binance volume and KYC template entry points | Implemented with public template IDs; validate suitability with Primus |
| ProofGate server verifier and durable replay protection | Implemented; Base Sepolia, server configuration required |
| Owner-authorized live ProofGate receipt + replay check | Pending |
| Production App ID/template confirmation | Pending Primus team guidance |
| Primus verifier adapter inside guest | Implemented against pinned official crate; attestor trust anchor needs Primus confirmation |
| Builder DVC service and on-chain eligibility verifier | Not connected; requires approved service access and verifier contract |

This is a **zkTLS** integration prototype, not a zkFHE computation-network integration. General incentive language elsewhere does not establish XP, token, Builder-role, or airdrop eligibility. No reward is promised by this repository.

## Run locally

The public UI is static, but ProofGate's API routes require Vercel's local runtime and server-only environment variables.

```bash
npm install
npx vercel dev
```

Open the local URL printed by Vercel, then visit `/`, `/credit-gate.html`, `/dvc-proof-lab.html`, or `/proofgate.html`. A plain static server can display the UI but cannot serve the ProofGate API. See [ProofGate setup](docs/PROOFGATE.md) for the required environment variables. Never commit `.env` files, private keys, API keys, or App Secrets.

## Project map

```text
index.html                 Main product page and Primus proof entry points
credit-gate.html           Policy compiler and DVC readiness guide
dvc-proof-lab.html         Synthetic DVC conformance workbench
dvc/credit-gate/            Host-tested Rust policy evaluator
dvc/credit-gate-program/    SP1 guest and compiled RISC-V ELF
dvc/local-runner/           Local CPU execute/prove CLI (no hosted proving)
dvc/test-vectors/           Versioned synthetic conformance fixtures
proofgate.html             Wallet/request-bound source verification UI
api/proofgate.js           Same-origin challenge and verification endpoint
lib/proofgate.js           Server-side verification and replay protection
src/primus-network.js      Primus Network-JS-SDK adapter
src/proofgate-*.js         ProofGate client, protocol, and UI logic
docs/                      Architecture, security, setup, and review notes
```

## Primus references

- [Primus Labs GitHub](https://github.com/primus-labs)
- [Primus documentation](https://docs.primuslabs.xyz/)
- [zkTLS Playground](https://primus-zktls-playground.vercel.app/)
- [Primus DVC architecture](https://github.com/primus-labs/DVC-Intro)
- [Primus DVC demo](https://github.com/primus-labs/DVC-Demo)
- [BNB ZK ID SDK](https://github.com/primus-labs/BNB-ZKID-SDK)

## Project status and recognition

This is an independent community project, not an official Primus Labs product or endorsed integration. The project is open to technical review and guidance on approved app/template setup. Builder recognition, XP, token rewards, and airdrop allocation depend on criteria set by Primus and are not guaranteed here.

## License

MIT — see [`LICENSE`](LICENSE).
