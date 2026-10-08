#![no_main]
sp1_zkvm::entrypoint!(main);

use anyhow::{anyhow, ensure, Context, Result};
#[path = "../../credit-gate/src/lib.rs"]
mod credit_gate;
use credit_gate::{evaluate, EligibilityOutput, VerifiedClaim};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sp1_zkvm::io::{commit, read};
use zktls_att_verification::attestation_data::{verify_attestation_data, AttestationConfig};

const BINANCE_VOLUME_URL: &str = "https://www.binance.com/bapi/accounts/v1/private/vip/vip-portal/vip-fee/vip-programs-and-fees";
const VOLUME_JSON_PATH: &str = "$.data.traderProgram.spotTrader.spotVolume30d";
const LEGACY_HASH_COMPARISON: &str = "HASH_COMPARSION";

#[derive(Deserialize)]
struct CreditGateMetadata {
    policy_json: Value,
    expected_policy_hash: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PublicOutput {
    eligibility: EligibilityOutput,
    attestor: String,
}

fn run(attestation_data: &str) -> Result<PublicOutput> {
    let raw_attestation: Value = serde_json::from_str(attestation_data)
        .context("invalid Primus attestation JSON")?;
    ensure!(
        raw_attestation.get("verification_type").and_then(Value::as_str) == Some(LEGACY_HASH_COMPARISON),
        "unsupported Primus DVC verification_type"
    );
    let metadata: CreditGateMetadata = serde_json::from_value(
        raw_attestation.get("credit_gate").cloned().context("missing credit_gate policy metadata")?
    ).context("invalid credit_gate policy metadata")?;
    let policy_json = serde_json::to_string(&metadata.policy_json)?;
    let chain_id = metadata.policy_json
        .get("binding")
        .and_then(|binding| binding.get("chainId"))
        .and_then(Value::as_u64)
        .context("missing policy chainId")?;
    let public_data = raw_attestation
        .get("public_data")
        .and_then(Value::as_array)
        .context("missing public_data")?;
    ensure!(public_data.len() == 1, "this guest accepts exactly one attestation");
    let attestor = public_data[0]
        .get("attestor")
        .and_then(Value::as_str)
        .context("missing attestor")?
        .to_owned();
    let attestation = &public_data[0]["attestation"];
    let recipient = attestation
        .get("recipient")
        .and_then(Value::as_str)
        .context("missing attestation recipient")?
        .to_owned();
    let timestamp = attestation
        .get("timestamp")
        .and_then(Value::as_u64)
        .context("missing signed attestation timestamp")?;

    // The URL is an exact fixed prefix from the selected official Binance template.
    // Primus's verifier checks the TLS response/hash and signature against this URL.
    let config = AttestationConfig {
        attestor_addr: attestor.clone(),
        url: vec![BINANCE_VOLUME_URL.to_owned()],
    };
    let config_json = serde_json::to_string(&config)?;
    let (_, _, messages) = verify_attestation_data(attestation_data, &config_json)
        .context("Primus signature, source URL, or response/hash verification failed")?;
    ensure!(messages.len() == 1 && messages[0].len() == 1, "unexpected verified response count");

    let values = messages[0][0]
        .get_json_values(&[VOLUME_JSON_PATH])
        .context("could not extract Binance spotVolume30d")?;
    ensure!(values.len() == 1, "expected exactly one spotVolume30d value");
    let value: Value = serde_json::from_str(&values[0]).context("invalid spotVolume30d JSON value")?;
    let volume_decimal = match value {
        Value::String(text) => text,
        Value::Number(number) => number.to_string(),
        _ => return Err(anyhow!("spotVolume30d must be a decimal string or number")),
    };

    let claim = VerifiedClaim::from_primus_verifier(
        "ad7d29c8-d820-495a-8bf1-02b8f236a1ae".to_owned(),
        "USD".to_owned(),
        recipient.clone(),
        chain_id,
        timestamp,
        volume_decimal,
    );
    let eligibility = evaluate(
        &policy_json,
        &metadata.expected_policy_hash,
        &recipient,
        &claim,
    )
    .map_err(|error| anyhow!("Credit Gate policy rejected claim: {error:?}"))?;

    Ok(PublicOutput { eligibility, attestor })
}

pub fn main() {
    let input: String = read();
    match run(&input) {
        Ok(output) => match serde_json::to_string(&output) {
            Ok(public_json) => commit(&(0u32, Some(public_json))),
            Err(_) => commit(&(1u32, None::<String>)),
        },
        Err(_) => commit(&(1u32, None::<String>)),
    }
}
