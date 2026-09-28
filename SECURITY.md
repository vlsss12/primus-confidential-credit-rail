# Security Policy

## Scope

This repository is a community prototype. The hosted sandbox uses synthetic data and does not request credentials.

## Reporting a vulnerability

Do not open a public issue for a security vulnerability. Contact the repository owner privately through GitHub, and do not include secret keys or personal data in a report.

## Security principles

- Never commit secrets.
- Never request a seed phrase or private key.
- Do not persist raw Web2 responses or account-level balances.
- Treat all proof results as untrusted until signature, source, freshness and policy checks pass.
