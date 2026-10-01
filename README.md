# Primus Confidential Credit Rail

An independent Primus zkTLS integration prototype and experimental credit-policy sandbox.

**Live product:** [primus-credit-rail.vercel.app](https://primus-credit-rail.vercel.app)

![Status](https://img.shields.io/badge/status-community%20prototype-33c7e8)
![Primus](https://img.shields.io/badge/Primus-zkTLS-ff6b35)
![License](https://img.shields.io/badge/license-MIT-72e6b3)

![Privacy × Verification](assets/primus-privacy-verification-banner.png)

## Why this exists

Institutional DeFi needs to verify eligibility without collecting a complete financial profile. Credit Rail is a product prototype for turning private Web2 and onchain signals into selective-disclosure claims:

```text
KYC verified · 30D volume > $1M · collateral ratio > 150%
```

This is the intended policy design, not a claim that the current prototype proves credit eligibility. The policy sandbox uses synthetic inputs. ProofGate verifies source-attestation provenance only and does not interpret KYC status, balances or trading volume for access decisions.

## Current product

- Interactive policy sandbox with pass/fail evaluation
- Synthetic credit posture and selective-disclosure source model
- Configurable trading-volume, collateral and KYC policy inputs
- Downloadable demonstration proof JSON
- Institutional dashboard for credit tier, proof freshness and risk signal
- Architecture view: source → zkTLS attestation → private computation → verifier → access
- Live Primus BNB ZK ID proof path using the public `@primuslabs/bnb-zkid-sdk` flow

> The policy sandbox uses synthetic data. The separate **Run a live Primus proof** path uses the public SDK test flow, requires the Primus Extension and a valid EVM address, and does not request a private key. The SDK proof flow may still require a Primus-registered app context and supported provider configuration.

## Primus integration path

This prototype is designed around public Primus concepts and open-source components:

- [Primus GitHub organization](https://github.com/primus-labs)
- [zkTLS tutorial](https://github.com/primus-labs/zkTLS-tutorial)
- [zkTLS contracts](https://github.com/primus-labs/zktls-contracts)
- [BNB ZKID SDK](https://github.com/primus-labs/BNB-ZKID-SDK)
- [Proof-of-Reserves docs](https://github.com/primus-labs/PoR-docs)
- [zkTLS Playground](https://primus-zktls-playground.vercel.app/)
- [Primus documentation](https://docs.primuslabs.xyz/)

The production path requires approved data templates, developer credentials and a supported Primus environment. Those are intentionally not bundled in this repository.

The site now links directly to the official zkTLS Playground and the Primus reference examples. The Playground is useful for validating request logic, but it is explicitly a simulation environment; it does not replace an approved App ID, template or server-side integration.

The current live proof implementation follows the public BNB ZK ID SDK sequence: initialize an app context, start a provider-specific proof request, surface progress events, and handle attested or failed results. It uses the public test identifiers documented by Primus and is intended as an integration reference until the team provides a production app context.

The repository also includes a Network-JS-SDK adapter at `src/primus-network.js`. It follows the official flow (`init` → `submitTask` → `attest` → `verifyAndPollTaskResult`) and supports Base Sepolia (`84532`) and Base mainnet (`8453`). It intentionally refuses to run without an approved Template ID; no guessed template or secret is included.

## Integration status

| Layer | Status |
| --- | --- |
| Institutional credit policy UI | Live |
| Synthetic policy evaluation | Live |
| Primus BNB ZK ID SDK flow | Integrated with public test context |
| Primus Network-JS-SDK adapter | Configured with published Binance volume and KYC template IDs |
| ProofGate server-side verifier | Implemented; 40 fixture-based tests passed on 2026-10-02 |
| ProofGate live end-to-end test | Configuration and Redis-backed challenge issuance passed on 2026-10-02; owner-authorized attestation/receipt test pending |
| Production App ID / template | Awaiting Primus team confirmation for this community project |
| Onchain verifier deployment | Planned after template approval |

The project is ready for Primus team feedback and an approved Builder integration. See the [Builder review packet](docs/BUILDER_REVIEW.md) and [integration request](docs/INTEGRATION_REQUEST.md).

This is a **zkTLS**, not a zkFHE computing-network integration. General developer-incentive language in zkFHE network documentation is not evidence that this project earns XP, tokens or Builder recognition. Track live validation separately in [the test record](docs/LIVE_TEST_RECORD.md).

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the proposed proof lifecycle, privacy boundaries and production hardening plan.

## Roadmap

- [x] Public institutional UI and policy sandbox
- [x] Synthetic proof export with explicit disclosure
- [x] Configure the published Binance 30-day spot volume template
- [x] Configure the published Binance KYC status template
- [ ] Replace synthetic policy output with the verified attestation result
- [ ] Add wallet signature and proof-request lifecycle
- [ ] Deploy a minimal verifier contract on a supported testnet
- [ ] Add policy versioning, expiry and revocation
- [ ] Add reproducible integration tests with no raw-data persistence

## Builder review checklist

The project is requesting recognition as an independent community Builder contribution. The following items are intentionally explicit for review:

- [x] Public GitHub repository and live demo
- [x] Official Primus Network-JS-SDK path in the codebase
- [x] Official Binance volume and KYC template IDs configured
- [x] User-side proof flow requiring the Primus Extension and wallet confirmation
- [x] No private key, API key, App Secret or raw attestation is committed or logged
- [ ] Primus team confirms the production App ID and approved workflow
- [ ] Primus team confirms Builder role or contribution eligibility

Builder role, points and token rewards are not guaranteed by this repository; they require explicit confirmation from Primus.

## Local run

This is a zero-build static prototype. Open `index.html` directly or serve the folder with any static web server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Important disclosure

This is an independent community prototype. It is not an official Primus Labs product, partnership, grant application or token-reward guarantee. Primus names and links are used only to identify the intended integration surface.

## License

MIT — see [`LICENSE`](LICENSE).
# ProofGate

The new [ProofGate workflow](docs/PROOFGATE.md) at `/proofgate.html` adds server-side, wallet/request-bound source attestation receipts with durable replay protection. Base Sepolia only; server configuration and a real owner-authorized end-to-end test are still required. It does not grant KYC/credit approval or claim Primus endorsement. Run `npm test` for verifier security tests.
