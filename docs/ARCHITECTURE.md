# Architecture

## Product goal

Convert sensitive financial inputs into verifiable policy claims while minimizing the data disclosed to a protocol.

## Proposed production flow

```text
Data source
  ├─ CEX / Web2 endpoint
  └─ Onchain wallets
        ↓
Primus zkTLS attestation
        ↓
Private computation (TEE / zkVM)
        ↓
Policy result + selective-disclosure proof
        ↓
Verifier contract
        ↓
Pool access · credit limit · fee tier · compliance decision
```

## Privacy boundary

The application must never persist API credentials, raw exchange responses, account-level balances or full trading history. The protocol should receive only the minimum claims required by its policy.

## Policy example

```json
{
  "volume_30d": { "operator": ">=", "value": 1000000, "unit": "USDT" },
  "collateral_ratio": { "operator": ">=", "value": 150, "unit": "percent" },
  "kyc": { "operator": "=", "value": true }
}
```

## Production requirements

1. Use only approved Primus templates and supported source endpoints.
2. Keep proof requests bound to a policy version, chain and expiry window.
3. Add replay protection, revocation and verifier-contract access control.
4. Make every policy decision auditable without revealing its private inputs.
5. Add negative-path tests for stale, revoked, malformed and insufficient proofs.
6. Never commit credentials; use environment variables and a server-side secret manager.

## Current prototype boundary

The hosted sandbox evaluates synthetic inputs in the browser. It demonstrates the product interaction and policy model but does not claim to produce a Primus cryptographic proof.
