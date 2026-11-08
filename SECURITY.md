# Security Policy

## Scope

This repository is an independent community integration. Its policy sandbox uses synthetic inputs. Owner-controlled Primus flows can handle real account attestations, and optional volume/DVC preparation may hold a complete response in the browser. ProofGate accepts request bindings, a task ID and a wallet signature, not raw exchange responses. See [architecture](docs/ARCHITECTURE.md) and [ProofGate boundaries](docs/PROOFGATE.md).

## Reporting a vulnerability

Use GitHub private vulnerability reporting if it is enabled for this repository. Otherwise, ask the maintainer for a private reporting channel without including exploit details in a public issue. This document does not imply that private reporting is enabled or that a bounty program exists.

Include affected files or a commit, the expected and observed behavior, and a minimal synthetic reproduction. Do not include private keys, account credentials, personal attestations or live wallet signatures. Prefer a local fixture over probing a deployed service.

## Security principles

- Never commit secrets.
- Never request a seed phrase or private key.
- Keep raw responses out of the application backend, logs, issues and Git. An explicit private DVC download remains sensitive.
- Treat all proof results as untrusted until signature, source, freshness and policy checks pass.
- Require an independently configured DVC signing address; do not trust a signer supplied by the input.
- Preserve wallet, origin, consumer, template, expiry and replay checks when changing ProofGate.

## Validation limits

The tests exercise controlled cases and are not a comprehensive security audit. Owner-authorized live receipt/replay validation, DVC template compatibility and an operational verifier configuration remain separate acceptance steps. No production credit or KYC authorization is provided.
