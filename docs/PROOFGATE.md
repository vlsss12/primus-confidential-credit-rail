# ProofGate by VLS

An independent **Base Sepolia source-attestation verifier**, with Credit Rail as its first consumer. Not an official Primus product, endorsed integration, credit-scoring system, or Builder/reward eligibility claim.

## What is implemented

1. The user sees the policy and explicitly consents to a testnet proof transaction.
2. A server-authenticated challenge binds a wallet, consumer, template, origin and 15-minute window.
3. Network-JS-SDK 0.1.11 passes the challenge binding in `additionParams` to the Primus Extension.
4. The wallet signs the exact origin/consumer/template/task/nonce/expiry message.
5. The server reads `queryTask` from Primus's Base Sepolia TaskManager at `0xC02234058caEaA9416506eABf6Ef3122fCA939E8`, two blocks behind the latest block. It requires SUCCESS, the expected submitter/template, a fresh task, complete distinct assigned-attestor results, matching recipients and matching `additionParams`.
6. An atomic Redis `SET NX EX` consumes the nonce before a minimal receipt is issued. A second use returns 409.

No browser-provided `verified` flag or attestation data is trusted. No credentials, private keys or raw attestation body are submitted to this app's API or stored in its Redis replay cache. The official SDK may emit its own browser console logs; attestors and onchain storage have their own disclosure properties. **Do not assume all attestation fields are private.**

## Scope and limitations

- The Binance KYC Status template ID is fixed to `9859330b-b94f-47a4-8f13-0ca56dabe273`.
- A successful source attestation can describe a negative KYC status. This implementation deliberately does not inspect or map `data`, so it **cannot authorize KYC-gated access or credit**.
- The receipt is informational JSON, **not a signed access token**. A real partner must reproduce verification on its own backend and define an explicit condition schema before access is granted.
- `partner-preview` demonstrates audience separation only. No external partner, cross-origin iframe, callback redirect or production-chain integration is enabled.
- The SDK passes `additionParams` into the extension, but a real user-authorized proof is still needed to verify it survives into the onchain result. Missing or transformed bindings fail closed. Do not remove that check to make a demo pass.
- Two-block confirmation does not guarantee finality; do not use this testnet receipt for money movement.
- No fraud/Sybil resistance, financial eligibility, revocation service or reward guarantees.

## Configure

Set these **server-only** variables in Vercel (or `.env.local` for local Vercel dev):

| Variable | Purpose |
| --- | --- |
| `PROOFGATE_SECRET` | Random secret of at least 32 bytes, never a wallet key |
| `PROOFGATE_ORIGIN` | Exact origin, e.g. `https://primus-credit-rail.vercel.app` (no trailing slash); local development uses `http://localhost:3000` |
| `PROOFGATE_RPC_URL` | Trusted HTTPS Base Sepolia RPC endpoint |
| `UPSTASH_REDIS_REST_URL` | HTTPS REST endpoint for a durable Redis database |
| `UPSTASH_REDIS_REST_TOKEN` | Server-only Redis write token |

Use a cryptographic random secret generator, for example `openssl rand -hex 32`. Do not commit the result. Redis configuration is required: an in-memory cache would not protect independent Vercel instances from replay. The status endpoint only checks configuration presence, not connectivity. The API enforces 12 POST requests per minute per hashed Vercel client IP via an atomic Redis script. Shared IPs share a bucket. This assumes Vercel's trusted `x-real-ip` header; use trusted proxy normalization on other hosts. Also apply edge/WAF limits and an RPC budget before exposing the verifier to broad public traffic. Configure Redis credentials using least privilege where available.

Run `npm install`, `npm test`, `npm run smoke`, then `npx vercel dev`. Visit `/proofgate.html`. A Python/static server cannot serve these APIs. With incomplete configuration, proof submission is disabled rather than emitting a synthetic receipt.

## API

`GET /api/proofgate` returns public readiness, template, chain and allowed audiences.

`POST /api/proofgate` accepts same-origin JSON only (8 KB limit):

```json
{"action":"challenge","wallet":"0x…","audience":"credit-rail"}
```

Then submit `action: verify`, `challenge`, `taskId` and `signature`. All policies are chosen by the server. Wallet login is verified at redemption. Invalid bindings, partial results, expiry, RPC failures and replay-store outages never issue a receipt.

An unconfirmed task returns HTTP 425 with `Retry-After: 4`. The client retries the same signed verification request up to eight times; it does not submit another task. Non-retryable errors and ambiguous connection failures stop the flow. Check the existing transaction/task before restarting after an error, since a transaction may already have been submitted or a request consumed. Wallet/network and expiry are rechecked before task submission, attestation, signing and redemption. Browser/server API calls have bounded network timeouts.

## Before claiming a live end-to-end integration

- Configure and redeploy the API; check connectivity without logging secrets.
- With the owner's explicit consent, complete one fresh Base Sepolia task through the extension and verify server receipt issuance.
- Re-submit the same signed request: expect 409. Change consumer, wallet or template: expect denial.
- Confirm the actual result `additionParams` format, without publishing personal attestation data.
- Review official SDK dependency advisories and the browser CDN dependency chain. Pinning is reproducibility, not a clean security audit.
- Only introduce KYC/financial authorization after defining and testing the exact official selective-claim schema.

Automated tests use local generated wallets and injected contract/storage fixtures. They do not submit transactions or demonstrate live Primus attestation success.
