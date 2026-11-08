# Developer Hub tutorial alignment

Checked 2026-11-08 against the [Developer Hub video](https://www.youtube.com/watch?v=WzHmhhM8HgM), its English auto-generated transcript, the live Hub, and current official documentation.

| Tutorial step | Our implementation | Evidence / remaining action |
| --- | --- | --- |
| Sign in to Hub, 0:09 | Registered project visible in the signed-in Hub | Project `2104955239034523648`; no credentials exported |
| Locate source/request and fields, 0:30–1:58 | Reuse published Binance volume and KYC templates | Public templates are explicitly offered by the tutorial at 3:16; creating an identical private template is unnecessary |
| Test the source, 2:02 | UI flow, wallet guards and fixture tests exist | Real owner template/receipt/replay test still required; no live pass claimed |
| Create a project, 2:43 | Primus Confidential Credit Rail exists | Public App ID recorded in review packet; Secret remains private |
| Install and integrate, 3:07 | Official Network SDK, pinned 0.1.11 | Current app follows the Network lifecycle rather than Enterprise request signing |
| Select public/private template, 3:16 | Volume template selected in the Hub code panel | Selection fills the generated example; it is not a reward submission or proof of live usage |
| Publish a custom template, 3:37 | No custom template published | Optional for original templates; not a requirement to reuse published templates |

## SDK distinction

The Hub's generated example uses `PrimusZKTLS` from `@primuslabs/zktls-js-sdk`. The current [Enterprise introduction](https://docs.primuslabs.xyz/enterprise/zk-tls-sdk/overview/) describes App ID/Secret integration; the [production example](https://docs.primuslabs.xyz/enterprise/zk-tls-sdk/production/) keeps signing on the backend.

Our application uses the separately documented [Network SDK](https://docs.primuslabs.xyz/build/overview/) and [DApp example](https://docs.primuslabs.xyz/build/for-dapp/example/). Its contract task, wallet, template and assigned attestors are its integration context. Do not insert an Enterprise Secret into browser code just to match a tutorial screenshot. Do not assume Network usage is automatically attributed to the registered App ID; ask Primus for the supported attribution mechanism.

## DVC compatibility

The official Network example's zkVM section pairs hashed attestations with the local HTTP response. The pinned Rust verifier compares SHA-256 of the complete response content to the signed value under that response's ID. A field-level plaintext result or the hash of only a volume field is insufficient to authenticate an arbitrary complete HTTP body.

The export preflight now rejects missing or mismatched complete-response commitments. A successful source task may therefore have no DVC export. Confirm a compatible template/schema with Primus before describing the DVC path as operational. See the [official DVC guide](https://docs.primuslabs.xyz/build/dvc/) and [reference implementation](https://github.com/primus-labs/DVC-Demo).

## Recognition and rewards

The video teaches development; it does not state reward eligibility. Hub registration, template selection, tests and deployment are technical evidence, not an approved incentive claim. Submit the review packet through the process Primus confirms and keep a record of its decision. No registration, reward claim, application or message has been sent automatically as part of preparing this document.
