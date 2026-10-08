# Credit Gate DVC implementation

## Implemented in this repository

`dvc/test-vectors/credit-gate-v1.json` is the shared, versioned synthetic conformance set. It covers eligible/ineligible outcomes, policy commitment mismatch, subject/template/chain binding, freshness, and invalid decimal precision. The Rust core consumes this exact file in its unit tests; the DVC Proof Lab runs the same scenario IDs in-browser and can export a report containing outcomes and content hashes only. Re-run the host suite with:

```sh
cargo test --locked --manifest-path dvc/credit-gate/Cargo.toml
```

GitHub Actions runs this command on pushes and pull requests. Passing these vectors validates the implemented policy/conformance behavior only; they do not contain a signed Primus response and cannot establish end-to-end DVC or proof validity.

`dvc/credit-gate` is a Rust business-logic core for the first Credit Gate rule. It:

- parses the existing policy JSON and recomputes its canonical SHA-256 digest;
- requires the caller's independently configured expected policy digest to match;
- accepts only the configured Binance 30-day volume template, USD denomination, and `>=` rule;
- compares fixed-point decimal volume without floating-point rounding (8 decimal places);
- binds the result to the expected subject and policy chain, and derives expiry from the attestation timestamp;
- returns only `{ policyHash, eligible, chainId, subject, expiresAt }`.

Run its unit tests with:

```sh
cargo test --manifest-path dvc/credit-gate/Cargo.toml
```

The Rust core is host-tested. The Primus DVC guest wrapper builds to the expected SP1 5.x 32-bit RISC-V ELF at `dvc/credit-gate-program/target/elf-compilation/riscv32im-succinct-zkvm-elf/release/credit-gate-dvc-program` (SHA-256 `7f807561fe2745ab8bf565414f20e96cdb5adc2e08bc34ca1cabbdce40693af6`). This confirms compilation only; the guest has **not** yet been executed against a real attestation, uploaded, proven, or connected to a deployed verifier/service.

The Binance volume page now retrieves the SDK's verified task response in browser memory and offers an explicit local JSON download in the documented DVC envelope (`verification_type`, `public_data`, `private_data.plain_json_response`). It does not upload this file to Vercel or any DVC endpoint. The export contains the raw Binance response and must be treated as sensitive; downloading it is optional and requires a separate click. This is payload preparation only, not DVC execution or a proof.

## Mandatory security boundary

The guest wrapper calls the pinned Primus zkTLS verifier before constructing `VerifiedClaim`; it checks the attestation signature, source URL, response and data-hash consistency before evaluating policy. However, its current config reads `attestor_addr` from the submitted attestation. That is not an independent trust anchor, so the result is not suitable for production until Primus confirms the approved attestor configuration and the guest is updated to pin it.

The selected DevHub Template Market entry is **Spot 30-Day Trade Volume**, template ID `ad7d29c8-d820-495a-8bf1-02b8f236a1ae`. Its provider is Binance, its request URL is `https://www.binance.com/bapi/accounts/v1/private/vip/vip-portal/vip-fee/vip-programs-and-fees`, and it extracts `spotVolume30d` at `$.data.traderProgram.spotTrader.spotVolume30d`, labeled in **USD**. The adapter is pinned to this exact template, URL and JSONPath. The exact normalization of live responses still needs end-to-end confirmation with a real, user-authorized attestation.

The installed `@primuslabs/network-js-sdk` requires `allJsonResponseFlag: 'true'`; the response accessor yields an array of `{ id, content }` items. The export follows the current official verifier crate's schema, including its legacy `verification_type` spelling `HASH_COMPARSION` and `private_data.plain_json_response` as that array. The guest reads the official DVC attestation JSON plus a `credit_gate` policy extension and runs the official Primus verifier before extracting the Binance value.

Do not copy Primus's sample business rule verbatim: its published Succinct example proves an ETH balance from Binance's signed `/api/v3/account` endpoint, not this project's 30-day spot-volume claim. That sample's local `.env` also includes Binance API credentials and a wallet private key. We have not imported or deployed those secrets or that unrelated endpoint.

## Still required for an end-to-end DVC run

1. Obtain the approved app/template context and confirm the Binance volume attestation schema and units with Primus.
2. Obtain the supported DVC service/prover endpoint, authentication method, upload flow, and program ID.
3. The official Primus verification program and guest wrapper are implemented and compiled. The SP1 5.x RV32 C compiler and matching archiver are required for the verifier's `secp256k1` build; the generated ELF is ignored by Git as a build artifact.
4. A local-only CPU runner executes the ELF and checks its explicit success/error status. An invalid `{}` input was rejected with status 1. No valid real attestation has been run yet, so positive-case behavior remains unverified.
5. Upload it only to the authorized service after Primus confirms the endpoint, authentication and program policy.
6. Add a server-side submit/status client using server-only configuration. Never put app secrets or user exchange credentials in browser code, logs, or Git.
7. Verify the returned proof against the selected testnet verifier/consumer contract, including policy-hash, subject, chain, expiry, and replay checks.
8. Run end-to-end positive and negative cases with a user-authorized attestation before describing the feature as live.

### Run the local runner

After the ELF is built, use a DVC JSON file explicitly downloaded from the app (it contains a raw Binance response and is sensitive):

```sh
cargo run --release --manifest-path dvc/local-runner/Cargo.toml -- \
  --mode execute --input /absolute/path/to/primus-dvc-input-private.json
```

To generate a local CPU proof and verify it locally with the matching key, change `--mode execute` to `--mode prove`. This can be resource-intensive. It saves proof, verification key and metadata under `dvc/proof-output/`; it does not upload anything and does not create an EVM/Primus DVC-service-compatible proof. Never commit the private input or share it. The downloaded file is currently user-provided; the local app does not expose a filesystem path to this runner automatically.

Primus's public DVC workflow describes compiling a Rust program to ELF, uploading it to DVC-Service to receive a program ID, submitting attestation data with that ID, and polling the task result. We have not uploaded anything or sent Binance data to a prover. The public demo's sample service is unauthenticated and stores submitted request data, so it must not be exposed publicly or used with real user data as-is. See the official [DVC demo developer guide](https://github.com/primus-labs/DVC-Demo/blob/main/DEVELOPER_GUIDE.md) and [DVC architecture](https://github.com/primus-labs/DVC-Intro).

The sample guest derives its verifier `attestor_addr` from the submitted attestation itself. A real credit decision must not treat that self-supplied value as a trust anchor. Primus must confirm the approved attestor configuration/verification contract, and downstream consumers must independently enforce it. The guest output includes the attestor identifier for that verification step; it is not itself a deployed on-chain verifier.

## Request for Primus

> We have implemented and host-tested a Credit Gate policy core, compiled an SP1 guest, and added a local CPU runner around the official Primus attestation verifier. We selected the DevHub Binance Spot 30-Day Trade Volume template (`ad7d29c8-d820-495a-8bf1-02b8f236a1ae`, `spotVolume30d`, USD). Could you confirm its exact response normalization, the approved attestor trust configuration, Builder access to the DVC service (endpoint/authentication/program upload), and the testnet proof-verification contract? We have not uploaded user data or claimed a live proof.
