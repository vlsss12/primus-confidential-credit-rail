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

- Network-JS-SDK: `@primuslabs/network-js-sdk`
- BNB ZK ID SDK: `@primuslabs/bnb-zkid-sdk`
- Binance 30-day volume template: `ad7d29c8-d820-495a-8bf1-02b8f236a1ae`
- Binance KYC status template: `9859330b-b94f-47a4-8f13-0ca56dabe273`
- Development chain for the Network flow: Base Sepolia (`84532`)

## Privacy and security boundary

- Users authenticate with their own Binance session through Primus Extension.
- The app does not request or store Binance passwords, API keys, wallet private keys or recovery phrases.
- Raw attestation objects are not printed to the browser console by the proof buttons.
- App Secrets are not included in the repository or frontend bundle.
- The synthetic policy export is clearly labelled as a demonstration and is not presented as a cryptographic attestation.

## Requested Primus review

Please confirm:

1. Whether the current Project/App ID may be used for this public community demo.
2. Whether the two published Binance templates are appropriate for this use case.
3. Whether any production configuration or server-side verification is required.
4. Whether this contribution qualifies for Builder recognition, points, or any published contribution program.

This repository does not claim an official partnership, Builder role, token allocation or reward eligibility until Primus confirms it.
