# Builder review packet

## Project

- Name: Primus Confidential Credit Rail
- Repository: https://github.com/vlsss12/primus-confidential-credit-rail
- Live demo: https://primus-credit-rail.vercel.app/
- Owner handle: VLS

## What is built

This is an independent privacy-focused finance prototype. It demonstrates how an institutional policy can consume selective claims rather than raw exchange balances or account history.

The public demo contains:

1. A synthetic policy sandbox for UX and policy evaluation.
2. A Primus BNB ZK ID reference flow.
3. A Primus Network-JS-SDK flow for the published Binance 30-day volume template.
4. A Primus Network-JS-SDK flow for the published Binance KYC status template.
5. A public architecture and privacy boundary.

## Primus surfaces used

### ProofGate: current review target

- Entry point: https://primus-credit-rail.vercel.app/proofgate.html
- Scope: zkTLS source-attestation verification on Base Sepolia, not zkFHE computation or financial authorization.
- Server verifier: reads the official TaskManager, checks wallet/template/request bindings and consumes a nonce atomically in Redis.
- Test coverage: 40 automated tests passed on 2026-10-02; fixtures are not evidence of a successful live attestation.
- Public deployment check on 2026-10-02 after Redis setup: `/api/proofgate` reported `ready: true`; a synthetic-address challenge returned HTTP 200. A real owner-authorized attestation and replay test are still pending.
- No live end-to-end success or Primus endorsement is claimed. See [ProofGate limitations](PROOFGATE.md) and [live test record](LIVE_TEST_RECORD.md).

The zkFHE Network document's general incentive language does not establish eligibility for this zkTLS prototype. Contributor recognition and any reward program require separately published criteria or explicit team confirmation.

- Network-JS-SDK: `@primuslabs/network-js-sdk`
- BNB ZK ID SDK: `@primuslabs/bnb-zkid-sdk`
- Binance 30-day volume template: `ad7d29c8-d820-495a-8bf1-02b8f236a1ae`
- Binance KYC status template: `9859330b-b94f-47a4-8f13-0ca56dabe273`
- Development chain for the Network flow: Base Sepolia (`84532`)

## Privacy and security boundary

- Users authenticate with their own Binance session through Primus Extension.
- The app does not request or store Binance passwords, API keys, wallet private keys or recovery phrases.
- ProofGate's API does not accept or store raw attestation bodies. Official SDK/extension logging and onchain disclosure have their own privacy properties; not all proof fields should be assumed private.
- App Secrets are not included in the repository or frontend bundle.
- The synthetic policy export is clearly labelled as a demonstration and is not presented as a cryptographic attestation.

## Requested Primus review

Please confirm:

1. Whether the current Project/App ID may be used for this public community demo.
2. Whether the two published Binance templates are appropriate for this use case.
3. Whether ProofGate's server-side task verification and `additionParams` request binding follow the recommended SDK workflow.
4. Which selective-claim schema is supported before interpreting KYC status or trading volume for any policy decision.
5. Whether reviewed zkTLS integrations and accepted PRs are tracked in any published Builder/contributor program, separately from XP and Reputation Score.

This repository does not claim an official partnership, Builder role, token allocation or reward eligibility until Primus confirms it.
