//! Deterministic business-logic core for the Credit Gate DVC program.
//!
//! This crate is deliberately not a Primus attestation verifier or a zkVM
//! guest. A production adapter must first invoke Primus's standard verifier
//! and validate signature, source URL, response, and data-hash consistency.
//! Only then may that adapter construct `VerifiedClaim` and call `evaluate`.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

const POLICY_SCHEMA: &str = "primus-credit-gate-policy/v1";
const VOLUME_TEMPLATE_ID: &str = "ad7d29c8-d820-495a-8bf1-02b8f236a1ae";
const VOLUME_SCALE: u128 = 100_000_000;
const MAX_POLICY_EXPIRY_SECONDS: u64 = 86_400;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GateError {
    InvalidPolicy(&'static str),
    PolicyHashMismatch,
    InvalidClaim(&'static str),
}

#[derive(Debug, Clone, Deserialize)]
struct Policy {
    schema: String,
    source: Source,
    rule: Rule,
    disclosure: Disclosure,
    binding: Binding,
    execution: Execution,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Source {
    provider: String,
    claim: String,
    template_id: String,
    denomination: String,
}

#[derive(Debug, Clone, Deserialize)]
struct Rule {
    field: String,
    operator: String,
    threshold: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Disclosure {
    eligible_only: bool,
    disclose_exact_value: bool,
    disclose_raw_response: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Binding {
    chain_id: u64,
    expires_in_seconds: u64,
    subject_required: bool,
    policy_hash_required: bool,
}

#[derive(Debug, Clone, Deserialize)]
struct Execution {
    mode: String,
    status: String,
}

/// Created only by an in-crate adapter after the Primus verifier succeeds.
/// The current repository does not yet contain that adapter.
#[derive(Debug, Clone)]
pub struct VerifiedClaim {
    template_id: String,
    denomination: String,
    recipient: String,
    chain_id: u64,
    attested_at: u64,
    volume_decimal: String,
}

impl VerifiedClaim {
    /// The future Primus adapter must call this only after cryptographic
    /// attestation, URL, response, and hash checks have all passed.
    #[allow(dead_code)] // Used by the Primus verifier adapter when it is added.
    pub(crate) fn from_primus_verifier(
        template_id: String,
        denomination: String,
        recipient: String,
        chain_id: u64,
        attested_at: u64,
        volume_decimal: String,
    ) -> Self {
        Self {
            template_id,
            denomination,
            recipient,
            chain_id,
            attested_at,
            volume_decimal,
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EligibilityOutput {
    pub policy_hash: String,
    pub eligible: bool,
    pub chain_id: u64,
    pub subject: String,
    /// Derived from the signed attestation timestamp; an onchain consumer
    /// must reject this output after this timestamp.
    pub expires_at: u64,
}

/// Evaluate one verified Binance 30-day volume claim against a compiled
/// Credit Gate policy. `expected_policy_hash` must come from the consumer's
/// trusted policy configuration, not from the same untrusted input as policy.
pub fn evaluate(
    policy_json: &str,
    expected_policy_hash: &str,
    expected_subject: &str,
    claim: &VerifiedClaim,
) -> Result<EligibilityOutput, GateError> {
    let mut raw: Value = serde_json::from_str(policy_json)
        .map_err(|_| GateError::InvalidPolicy("policy JSON is malformed"))?;
    let object = raw
        .as_object_mut()
        .ok_or(GateError::InvalidPolicy("policy must be a JSON object"))?;
    if object.contains_key("policyHash") {
        object.remove("policyHash");
    }
    let computed = format!(
        "sha256:{}",
        hex(&Sha256::digest(canonical_json(&raw).as_bytes()))
    );
    if computed != expected_policy_hash {
        return Err(GateError::PolicyHashMismatch);
    }

    let policy: Policy = serde_json::from_value(raw)
        .map_err(|_| GateError::InvalidPolicy("policy fields do not match the supported schema"))?;
    validate_policy(&policy)?;

    if claim.template_id != policy.source.template_id {
        return Err(GateError::InvalidClaim("template does not match policy"));
    }
    if claim.denomination != policy.source.denomination {
        return Err(GateError::InvalidClaim(
            "volume denomination does not match policy",
        ));
    }
    if !valid_evm_address(expected_subject)
        || !claim.recipient.eq_ignore_ascii_case(expected_subject)
    {
        return Err(GateError::InvalidClaim(
            "recipient does not match the bound subject",
        ));
    }
    if claim.chain_id != policy.binding.chain_id {
        return Err(GateError::InvalidClaim(
            "claim is bound to a different chain",
        ));
    }
    let expires_at = claim
        .attested_at
        .checked_add(policy.binding.expires_in_seconds)
        .ok_or(GateError::InvalidClaim("expiry timestamp overflow"))?;
    let volume_scaled = parse_fixed_8(&claim.volume_decimal)?;
    let threshold_scaled = u128::from(policy.rule.threshold)
        .checked_mul(VOLUME_SCALE)
        .ok_or(GateError::InvalidPolicy("threshold is too large"))?;

    Ok(EligibilityOutput {
        policy_hash: computed,
        eligible: volume_scaled >= threshold_scaled,
        chain_id: policy.binding.chain_id,
        subject: expected_subject.to_ascii_lowercase(),
        expires_at,
    })
}

fn validate_policy(policy: &Policy) -> Result<(), GateError> {
    if policy.schema != POLICY_SCHEMA {
        return Err(GateError::InvalidPolicy("unsupported policy schema"));
    }
    if policy.source.provider != "binance"
        || policy.source.claim != "spot_trade_volume_30d"
        || policy.source.template_id != VOLUME_TEMPLATE_ID
    {
        return Err(GateError::InvalidPolicy(
            "unsupported attestation source or template",
        ));
    }
    if policy.source.denomination != "USD" {
        return Err(GateError::InvalidPolicy("unsupported denomination"));
    }
    if policy.rule.field != "spot_trade_volume_30d" || policy.rule.operator != ">=" {
        return Err(GateError::InvalidPolicy("unsupported policy rule"));
    }
    if !policy.disclosure.eligible_only
        || policy.disclosure.disclose_exact_value
        || policy.disclosure.disclose_raw_response
    {
        return Err(GateError::InvalidPolicy(
            "policy requests excess disclosure",
        ));
    }
    if !policy.binding.subject_required || !policy.binding.policy_hash_required {
        return Err(GateError::InvalidPolicy(
            "subject and policy-hash binding are mandatory",
        ));
    }
    if policy.binding.chain_id != 84532 && policy.binding.chain_id != 8453 {
        return Err(GateError::InvalidPolicy("unsupported target chain"));
    }
    if policy.binding.expires_in_seconds == 0
        || policy.binding.expires_in_seconds > MAX_POLICY_EXPIRY_SECONDS
    {
        return Err(GateError::InvalidPolicy(
            "expiry must be between 1 second and 24 hours",
        ));
    }
    if policy.execution.mode != "primus-dvc-zkvm"
        || policy.execution.status != "configuration-only-no-proof-generated"
    {
        return Err(GateError::InvalidPolicy("unexpected execution metadata"));
    }
    Ok(())
}

fn valid_evm_address(address: &str) -> bool {
    address.len() == 42
        && address.starts_with("0x")
        && address[2..].bytes().all(|b| b.is_ascii_hexdigit())
}

/// Parse a non-negative decimal volume exactly at 8 decimal places.
/// The adapter must confirm the Binance template's units and normalize to
/// this representation before constructing `VerifiedClaim`.
fn parse_fixed_8(value: &str) -> Result<u128, GateError> {
    if value.is_empty() || value.starts_with('-') || value.starts_with('+') {
        return Err(GateError::InvalidClaim(
            "volume must be a non-negative decimal",
        ));
    }
    let mut parts = value.split('.');
    let whole = parts.next().unwrap_or_default();
    let fractional = parts.next().unwrap_or("");
    if parts.next().is_some()
        || whole.is_empty()
        || !whole.bytes().all(|b| b.is_ascii_digit())
        || !fractional.bytes().all(|b| b.is_ascii_digit())
        || fractional.len() > 8
    {
        return Err(GateError::InvalidClaim(
            "volume is not a valid 8-decimal value",
        ));
    }
    let whole: u128 = whole
        .parse()
        .map_err(|_| GateError::InvalidClaim("volume is out of range"))?;
    let fraction_text = format!("{fractional:0<8}");
    let fraction: u128 = if fraction_text.is_empty() {
        0
    } else {
        fraction_text
            .parse()
            .map_err(|_| GateError::InvalidClaim("volume is out of range"))?
    };
    whole
        .checked_mul(VOLUME_SCALE)
        .and_then(|n| n.checked_add(fraction))
        .ok_or(GateError::InvalidClaim("volume is out of range"))
}

fn canonical_json(value: &Value) -> String {
    match value {
        Value::Object(map) => {
            let sorted: BTreeMap<&String, &Value> = map.iter().collect();
            let entries = sorted
                .into_iter()
                .map(|(key, value)| {
                    format!(
                        "{}:{}",
                        serde_json::to_string(key).expect("string serialization"),
                        canonical_json(value)
                    )
                })
                .collect::<Vec<_>>()
                .join(",");
            format!("{{{entries}}}")
        }
        Value::Array(items) => format!(
            "[{}]",
            items
                .iter()
                .map(canonical_json)
                .collect::<Vec<_>>()
                .join(",")
        ),
        _ => serde_json::to_string(value).expect("JSON value serialization"),
    }
}

fn hex(bytes: &[u8]) -> String {
    const TABLE: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(TABLE[(byte >> 4) as usize] as char);
        out.push(TABLE[(byte & 0x0f) as usize] as char);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const SUBJECT: &str = "0x1234567890abcdef1234567890abcdef12345678";
    const POLICY: &str = r#"{
      "schema":"primus-credit-gate-policy/v1",
      "name":"Institutional volume gate",
      "version":"1.0.0",
      "source":{"provider":"binance","claim":"spot_trade_volume_30d","templateId":"ad7d29c8-d820-495a-8bf1-02b8f236a1ae","denomination":"USD"},
      "rule":{"field":"spot_trade_volume_30d","operator":">=","threshold":1000000},
      "disclosure":{"eligibleOnly":true,"discloseExactValue":false,"discloseRawResponse":false},
      "binding":{"chainId":84532,"expiresInSeconds":900,"subjectRequired":true,"policyHashRequired":true},
      "execution":{"mode":"primus-dvc-zkvm","status":"configuration-only-no-proof-generated"}
    }"#;

    fn policy_hash() -> String {
        let value: Value = serde_json::from_str(POLICY).unwrap();
        format!(
            "sha256:{}",
            hex(&Sha256::digest(canonical_json(&value).as_bytes()))
        )
    }

    fn claim(volume: &str) -> VerifiedClaim {
        VerifiedClaim::from_primus_verifier(
            VOLUME_TEMPLATE_ID.into(),
            "USD".into(),
            SUBJECT.into(),
            84532,
            1_800_000_000,
            volume.into(),
        )
    }

    #[test]
    fn outputs_only_minimal_bound_eligibility() {
        let output = evaluate(POLICY, &policy_hash(), SUBJECT, &claim("1000000.00000000")).unwrap();
        assert!(output.eligible);
        assert_eq!(output.chain_id, 84532);
        assert_eq!(output.subject, SUBJECT);
        assert_eq!(output.expires_at, 1_800_000_900);
        let json = serde_json::to_value(output).unwrap();
        assert_eq!(json.as_object().unwrap().len(), 5);
        assert!(json.get("volume").is_none());
    }

    #[test]
    fn policy_hash_matches_the_browser_compiler_test_vector() {
        assert_eq!(
            policy_hash(),
            "sha256:84ef8ea18f4e12144d5f2abc36a4e65b6625cd91a9fbaee40d5744f473afee2e"
        );
    }

    #[test]
    fn below_threshold_is_not_eligible() {
        let output = evaluate(POLICY, &policy_hash(), SUBJECT, &claim("999999.99999999")).unwrap();
        assert!(!output.eligible);
    }

    #[test]
    fn rejects_wrong_policy_commitment() {
        assert_eq!(
            evaluate(POLICY, "sha256:00", SUBJECT, &claim("1000000")),
            Err(GateError::PolicyHashMismatch)
        );
    }

    #[test]
    fn rejects_wrong_subject_and_chain() {
        let wrong_subject = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        assert_eq!(
            evaluate(POLICY, &policy_hash(), wrong_subject, &claim("1000000")),
            Err(GateError::InvalidClaim(
                "recipient does not match the bound subject"
            ))
        );
        let wrong_chain = VerifiedClaim::from_primus_verifier(
            VOLUME_TEMPLATE_ID.into(),
            "USD".into(),
            SUBJECT.into(),
            1,
            1_800_000_000,
            "1000000".into(),
        );
        assert_eq!(
            evaluate(POLICY, &policy_hash(), SUBJECT, &wrong_chain),
            Err(GateError::InvalidClaim(
                "claim is bound to a different chain"
            ))
        );
    }

    #[test]
    fn rejects_denomination_mismatch() {
        let wrong_denomination = VerifiedClaim::from_primus_verifier(
            VOLUME_TEMPLATE_ID.into(),
            "USDC".into(),
            SUBJECT.into(),
            84532,
            1_800_000_000,
            "1000000".into(),
        );
        assert_eq!(
            evaluate(POLICY, &policy_hash(), SUBJECT, &wrong_denomination),
            Err(GateError::InvalidClaim(
                "volume denomination does not match policy"
            ))
        );
    }

    #[test]
    fn rejects_bad_templates_and_excess_disclosure() {
        let mut value: Value = serde_json::from_str(POLICY).unwrap();
        value["source"]["templateId"] = Value::String("attacker-template".into());
        let (text, hash) = compile(value);
        assert!(matches!(
            evaluate(&text, &hash, SUBJECT, &claim("1000000")),
            Err(GateError::InvalidPolicy(_))
        ));

        let mut value: Value = serde_json::from_str(POLICY).unwrap();
        value["disclosure"]["discloseExactValue"] = Value::Bool(true);
        let (text, hash) = compile(value);
        assert!(matches!(
            evaluate(&text, &hash, SUBJECT, &claim("1000000")),
            Err(GateError::InvalidPolicy(_))
        ));
    }

    #[test]
    fn parses_fixed_point_without_float_rounding() {
        assert_eq!(parse_fixed_8("1.00000001").unwrap(), 100_000_001);
        assert!(parse_fixed_8("1.000000001").is_err());
        assert!(parse_fixed_8("NaN").is_err());
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct VectorManifest {
        policy_hash: String,
        fixed_now: u64,
        subject: String,
        vectors: Vec<TestVector>,
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct TestVector {
        id: String,
        policy_hash: Option<String>,
        claim: VectorClaim,
        expected: String,
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct VectorClaim {
        template_id: String,
        denomination: String,
        recipient: String,
        chain_id: u64,
        attested_at: u64,
        volume: String,
    }

    #[test]
    fn shared_public_test_vectors_match_expected_core_and_freshness_results() {
        let manifest: VectorManifest = serde_json::from_str(include_str!(
            "../../test-vectors/credit-gate-v1.json"
        ))
        .expect("public conformance vectors must be valid JSON");
        let policy = include_str!("../../../credit-gate-policy-v1.0.0.json");

        for vector in manifest.vectors {
            let claim = VerifiedClaim::from_primus_verifier(
                vector.claim.template_id,
                vector.claim.denomination,
                vector.claim.recipient,
                vector.claim.chain_id,
                vector.claim.attested_at,
                vector.claim.volume,
            );
            let result = evaluate(
                policy,
                vector.policy_hash.as_deref().unwrap_or(&manifest.policy_hash),
                &manifest.subject,
                &claim,
            );
            let observed = match &result {
                Ok(output) if output.expires_at <= manifest.fixed_now => "rejected",
                Ok(output) if output.eligible => "eligible",
                Ok(_) => "ineligible",
                Err(_) => "rejected",
            };
            assert_eq!(observed, vector.expected, "vector: {}", vector.id);

            if observed == "eligible" || observed == "ineligible" {
                let output = result.expect("accepted vectors must return the minimal result");
                let json = serde_json::to_value(output).unwrap();
                assert_eq!(json.as_object().unwrap().len(), 5, "vector: {}", vector.id);
                assert!(json.get("volume").is_none(), "vector: {}", vector.id);
            }
        }
    }

    fn compile(value: Value) -> (String, String) {
        let text = serde_json::to_string(&value).unwrap();
        let hash = format!(
            "sha256:{}",
            hex(&Sha256::digest(canonical_json(&value).as_bytes()))
        );
        (text, hash)
    }
}
