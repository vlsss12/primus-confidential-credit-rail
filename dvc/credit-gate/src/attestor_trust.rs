//! An attestation must never choose its own trusted signing key.
//! The guest supplies `configured` from its build environment, not proof JSON.

#[derive(Debug, PartialEq, Eq)]
pub enum AttestorTrustError {
    MissingConfiguration,
    InvalidConfiguration,
    InvalidAttestor,
    UntrustedAttestor,
}

fn valid_address(value: &str) -> bool {
    value.len() == 42
        && value.starts_with("0x")
        && value[2..].bytes().all(|byte| byte.is_ascii_hexdigit())
        && value[2..].bytes().any(|byte| byte != b'0')
}

pub fn require_trusted_attestor(
    configured: Option<&str>,
    claimed: &str,
) -> Result<String, AttestorTrustError> {
    let trusted = configured.ok_or(AttestorTrustError::MissingConfiguration)?;
    if !valid_address(trusted) {
        return Err(AttestorTrustError::InvalidConfiguration);
    }
    if !valid_address(claimed) {
        return Err(AttestorTrustError::InvalidAttestor);
    }
    if !trusted.eq_ignore_ascii_case(claimed) {
        return Err(AttestorTrustError::UntrustedAttestor);
    }
    Ok(trusted.to_ascii_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;
    const TRUSTED: &str = "0x1111111111111111111111111111111111111111";
    const ATTACKER: &str = "0x2222222222222222222222222222222222222222";

    #[test]
    fn rejects_a_self_selected_signer() {
        assert_eq!(
            require_trusted_attestor(Some(TRUSTED), ATTACKER),
            Err(AttestorTrustError::UntrustedAttestor)
        );
    }

    #[test]
    fn fails_closed_without_independent_configuration() {
        assert_eq!(
            require_trusted_attestor(None, TRUSTED),
            Err(AttestorTrustError::MissingConfiguration)
        );
        for invalid in [
            "",
            "not-an-address",
            "0x0000000000000000000000000000000000000000",
        ] {
            assert_eq!(
                require_trusted_attestor(Some(invalid), TRUSTED),
                Err(AttestorTrustError::InvalidConfiguration)
            );
        }
    }

    #[test]
    fn rejects_malformed_claims_and_accepts_matching_addresses() {
        assert_eq!(
            require_trusted_attestor(Some(TRUSTED), "0x1234"),
            Err(AttestorTrustError::InvalidAttestor)
        );
        assert_eq!(
            require_trusted_attestor(Some(TRUSTED), TRUSTED),
            Ok(TRUSTED.to_owned())
        );
        let mixed = format!("0x{}", "aB".repeat(20));
        assert_eq!(
            require_trusted_attestor(Some(&mixed), &mixed.to_ascii_lowercase()),
            Ok(mixed.to_ascii_lowercase())
        );
    }
}
