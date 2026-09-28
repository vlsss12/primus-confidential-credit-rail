# Primus Integration Request

## Context

Primus Confidential Credit Rail is an independent community prototype for privacy-preserving institutional credit policies. It provides a live UI, a synthetic policy sandbox, and a public BNB ZK ID SDK flow.

## Requested guidance

We are looking for the recommended path to:

1. Obtain an approved App ID for a community integration.
2. Select or create a supported Primus data template for an institutional credit claim.
3. Run the proof flow on the recommended testnet.
4. Verify the resulting attestation or proof in a minimal policy contract.
5. Follow any Primus Builder, Developer or Ecosystem review process.

## Proposed first policy

```text
30-day trading-volume band >= $1M
collateral ratio >= 150%
KYC claim = verified
```

The application should receive only the policy result. It must not persist API credentials, raw exchange responses, account-level balances or complete trading history.

## Links

- Live demo: https://primus-credit-rail.vercel.app
- Repository: https://github.com/vlsss12/primus-confidential-credit-rail
- Primus BNB ZKID SDK: https://github.com/primus-labs/BNB-ZKID-SDK
