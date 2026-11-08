# Integration validation, 2026-11-08

## Code corrections

- All Network SDK browser paths use `src/primus-sdk.js`, pinned to the same `0.1.11` release as the package and lockfile. Removed duplicate legacy implementations of the Binance volume/KYC functions.
- DVC rejects a signer that differs from the independently configured build-time `PRIMUS_DVC_TRUSTED_ATTESTOR`. Missing trust configuration rejects all inputs. No signing address is invented or copied from a proof.
- CI runs JavaScript tests in addition to smoke and Rust conformance checks.
- Ordinary source checks no longer request or retrieve the full private response. Volume export preparation explicitly opts in, then compares SHA-256 of the complete response against its signed commitment before offering a local download. Plaintext, missing commitments and altered bodies are rejected.

## Live acceptance remains separate

`GET /api/proofgate` returning `ready: true` establishes configuration presence only. A successful test must show all of the following using the owner's own wallet/provider session:

1. One Base Sepolia task, with the expected Binance KYC template and exact server request binding.
2. A wallet signature of the displayed verification request and an HTTP 200 source receipt from the server.
3. Replaying the identical signed request returns HTTP 409. A different wallet, template, audience or expired challenge is rejected.

Use the UI at `/proofgate.html`. Check an existing task/transaction before submitting another. Wallet transaction and signature approvals are performed by the owner. Store no private exchange response, signature, challenge or credentials in Git. Automated fixtures are not live acceptance evidence.

## DVC acceptance

Before a real DVC run, independently verify the trusted attestor address, embed it while rebuilding the SP1 guest, record its new ELF digest, and pin the corresponding verification key in the relying consumer. Then execute a real owner-provided DVC input locally and validate the positive and negative cases. The historical guest binary must not be reused as evidence for the changed code.

## Validation results

- `npm test`: 51 passed, 0 failed. Includes SDK pinning, wallet/chain/expiry checks, source receipt validation and replay rejection with fixtures, opt-in private response handling and DVC export commitment checks.
- Rust core: 12 passed, 0 failed, including missing trust configuration, malformed/zero addresses and attacker-selected signer rejection.
- `npm run smoke`: passed, 14 product markers.
- Patched SP1 guest rebuilt successfully as a 32-bit RISC-V ELF with the installed SP1 5.2 toolchain and compatible Cargo 1.88. SHA-256: `f04f96b16ed665bba2866afb8f13d8f8e0d44b9c85135715159c98c32a382ff6`. This build deliberately has no trusted attestor configured and rejects every input; it is compilation evidence only, not an operational proof program. Cargo 1.99 with this older SP1 compiler failed on `remap-path-scope`; using Cargo 1.88 with the SP1 compiler resolved the build.
- Browser check on the production ProofGate: server configured; request correctly stopped with `Switch your wallet to Base Sepolia (84532).` No proof transaction was submitted and no live receipt was issued.
- Live owner task, receipt/replay and successful DVC execution remain pending. Do not present fixture tests or configuration readiness as successful live proof evidence.
