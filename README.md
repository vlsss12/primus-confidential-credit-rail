# Primus Confidential Credit Rail

Privacy-preserving credit eligibility for institutional onchain finance.

**Live product:** [primus-credit-rail.vercel.app](https://primus-credit-rail.vercel.app)

![Privacy × Verification](assets/primus-privacy-verification-banner.png)

## Why this exists

Institutional DeFi needs to verify eligibility without collecting a complete financial profile. Credit Rail is a product prototype for turning private Web2 and onchain signals into selective-disclosure claims:

```text
KYC verified · 30D volume > $1M · collateral ratio > 150%
```

The protocol receives the claim it needs—not raw balances, API credentials, or account-level history.

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

The production path requires approved data templates, developer credentials and a supported Primus environment. Those are intentionally not bundled in this repository.

The current live proof implementation follows the public BNB ZK ID SDK sequence: initialize an app context, start a provider-specific proof request, surface progress events, and handle attested or failed results. It uses the public test identifiers documented by Primus and is intended as an integration reference until the team provides a production app context.

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the proposed proof lifecycle, privacy boundaries and production hardening plan.

## Roadmap

- [x] Public institutional UI and policy sandbox
- [x] Synthetic proof export with explicit disclosure
- [ ] Replace synthetic sources with approved Primus templates
- [ ] Add wallet signature and proof-request lifecycle
- [ ] Deploy a minimal verifier contract on a supported testnet
- [ ] Add policy versioning, expiry and revocation
- [ ] Add reproducible integration tests with no raw-data persistence

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
