# Contributing

Thanks for helping improve Primus Confidential Credit Rail.

## Before opening a change

- Keep the prototype privacy-first and avoid adding credentials or personal data.
- Do not describe synthetic results as real Primus attestations.
- Keep Primus references factual and link to official documentation.
- Prefer small, reviewable changes with a clear product or security reason.

## Development

This repository is a static prototype. Open `index.html` directly or run:

```bash
python3 -m http.server 8080
```

Run the smoke check before opening a pull request:

```bash
node scripts/smoke-test.mjs
```

## Pull requests

Include the user-facing change, how it was tested, and any privacy implications. Never include API keys, seed phrases, private keys or raw user data.
