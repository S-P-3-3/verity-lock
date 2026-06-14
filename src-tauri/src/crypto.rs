//! Cryptographic primitives for sp3 Passwortmanager.
//!
//! Key derivation: Argon2id (memory 64 MiB, time 3, parallelism 4) -> 256-bit key.
//! Encryption: AES-256-GCM (authenticated, integrity is provided by the GCM tag).
//!
//! Nothing in here ever writes to disk; callers own the lifetime of secrets.

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use rand::rngs::OsRng;
use rand::RngCore;
use zeroize::Zeroize;

pub const SALT_LEN: usize = 32;
pub const NONCE_LEN: usize = 12;
pub const KEY_LEN: usize = 32;

// Argon2id parameters — deliberately heavy ("overkill secure").
const ARGON2_MEMORY_KIB: u32 = 64 * 1024; // 64 MiB
const ARGON2_TIME_COST: u32 = 3;
const ARGON2_PARALLELISM: u32 = 4;

/// A 256-bit symmetric key that zeroizes its bytes when dropped.
pub struct DerivedKey(pub [u8; KEY_LEN]);

impl Drop for DerivedKey {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

/// Generate `n` cryptographically secure random bytes from the OS CSPRNG.
pub fn random_bytes(n: usize) -> Vec<u8> {
    let mut buf = vec![0u8; n];
    OsRng.fill_bytes(&mut buf);
    buf
}

pub fn random_salt() -> [u8; SALT_LEN] {
    let mut salt = [0u8; SALT_LEN];
    OsRng.fill_bytes(&mut salt);
    salt
}

pub fn random_nonce() -> [u8; NONCE_LEN] {
    let mut nonce = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce);
    nonce
}

/// Derive a 256-bit key from the master password and salt using Argon2id.
pub fn derive_key(password: &str, salt: &[u8]) -> Result<DerivedKey, String> {
    if salt.len() != SALT_LEN {
        return Err(format!("invalid salt length: {}", salt.len()));
    }
    let params = Params::new(
        ARGON2_MEMORY_KIB,
        ARGON2_TIME_COST,
        ARGON2_PARALLELISM,
        Some(KEY_LEN),
    )
    .map_err(|e| format!("argon2 params: {e}"))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut key = [0u8; KEY_LEN];
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| format!("key derivation failed: {e}"))?;
    Ok(DerivedKey(key))
}

/// Encrypt `plaintext` with AES-256-GCM. Returns ciphertext (incl. 16-byte tag).
/// `aad` is authenticated but not encrypted (used for the vault header).
pub fn encrypt(
    key: &DerivedKey,
    nonce: &[u8; NONCE_LEN],
    plaintext: &[u8],
    aad: &[u8],
) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key.0));
    cipher
        .encrypt(
            Nonce::from_slice(nonce),
            Payload {
                msg: plaintext,
                aad,
            },
        )
        .map_err(|_| "encryption failed".to_string())
}

/// Decrypt AES-256-GCM ciphertext. Fails if the tag/AAD do not verify
/// (wrong password, corruption, or tampering).
pub fn decrypt(
    key: &DerivedKey,
    nonce: &[u8; NONCE_LEN],
    ciphertext: &[u8],
    aad: &[u8],
) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key.0));
    cipher
        .decrypt(
            Nonce::from_slice(nonce),
            Payload {
                msg: ciphertext,
                aad,
            },
        )
        .map_err(|_| "decryption failed: wrong master password or corrupted vault".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_derivation_is_deterministic() {
        let salt = [7u8; SALT_LEN];
        let a = derive_key("correct horse battery staple", &salt).unwrap();
        let b = derive_key("correct horse battery staple", &salt).unwrap();
        assert_eq!(a.0, b.0);
    }

    #[test]
    fn different_passwords_yield_different_keys() {
        let salt = [7u8; SALT_LEN];
        let a = derive_key("password-one", &salt).unwrap();
        let b = derive_key("password-two", &salt).unwrap();
        assert_ne!(a.0, b.0);
    }

    #[test]
    fn different_salts_yield_different_keys() {
        let a = derive_key("same-password", &[1u8; SALT_LEN]).unwrap();
        let b = derive_key("same-password", &[2u8; SALT_LEN]).unwrap();
        assert_ne!(a.0, b.0);
    }

    #[test]
    fn encrypt_then_decrypt_roundtrips() {
        let key = derive_key("hunter2", &[9u8; SALT_LEN]).unwrap();
        let nonce = random_nonce();
        let msg = b"top secret vault contents";
        let aad = b"SP3V\x01";
        let ct = encrypt(&key, &nonce, msg, aad).unwrap();
        assert_ne!(ct.as_slice(), msg, "ciphertext must differ from plaintext");
        let pt = decrypt(&key, &nonce, &ct, aad).unwrap();
        assert_eq!(pt, msg);
    }

    #[test]
    fn wrong_password_fails_to_decrypt() {
        let salt = [3u8; SALT_LEN];
        let good = derive_key("right", &salt).unwrap();
        let bad = derive_key("wrong", &salt).unwrap();
        let nonce = random_nonce();
        let ct = encrypt(&good, &nonce, b"secret", b"aad").unwrap();
        assert!(decrypt(&bad, &nonce, &ct, b"aad").is_err());
    }

    #[test]
    fn tampered_ciphertext_is_rejected() {
        let key = derive_key("pw", &[5u8; SALT_LEN]).unwrap();
        let nonce = random_nonce();
        let mut ct = encrypt(&key, &nonce, b"secret data", b"aad").unwrap();
        ct[0] ^= 0xFF; // flip a bit
        assert!(decrypt(&key, &nonce, &ct, b"aad").is_err());
    }

    #[test]
    fn wrong_aad_is_rejected() {
        let key = derive_key("pw", &[5u8; SALT_LEN]).unwrap();
        let nonce = random_nonce();
        let ct = encrypt(&key, &nonce, b"secret", b"header-v1").unwrap();
        assert!(decrypt(&key, &nonce, &ct, b"header-v2").is_err());
    }

    #[test]
    fn random_salts_are_unique() {
        assert_ne!(random_salt(), random_salt());
    }
}
