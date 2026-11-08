# Contributing

Thanks for helping improve Primus Confidential Credit Rail.

## Before opening a change

- Keep the prototype privacy-first and avoid adding credentials or personal data.
- Do not describe synthetic results as real Primus attestations.
- Keep Primus references factual and link to official documentation.
- Prefer small, reviewable changes with a clear product or security reason.

## Development

Use Node.js 20 or later, npm, and a stable Rust toolchain for the policy-core tests. Install the locked JavaScript dependencies, then start Vercel's development runtime:

```bash
npm ci --ignore-scripts
npx vercel dev
```

Configure the server-only values described in [ProofGate setup](docs/PROOFGATE.md) when testing its API. A plain static server only displays the UI; it cannot verify a ProofGate request. Keep local environment files out of Git.

Run the checks relevant to your change before opening a pull request:

```bash
npm test
npm run smoke
cargo test --locked --manifest-path dvc/credit-gate/Cargo.toml
```

## Pull requests

Include the user-facing change, how it was tested, and any privacy implications. Never include API keys, seed phrases, private keys or raw user data.

For SDK changes, update the reviewed version consistently in the package, lockfile and shared browser loader. For policy changes, keep the browser and Rust implementations aligned with the shared vectors. For DVC changes, record the guest build and trust assumptions; a compiled ELF or synthetic fixture is not evidence of a successful live proof.

See the [documentation index](docs/README.md) for architecture, validation and integration boundaries. Report sensitive vulnerabilities using the [security policy](SECURITY.md), rather than publishing exploit details in an issue.
