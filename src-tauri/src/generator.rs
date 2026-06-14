//! Password & passphrase generation plus a lightweight strength estimator.
//! Uses the OS CSPRNG (via `crypto::random_bytes`) for unbiased selection.

use serde::{Deserialize, Serialize};

use crate::crypto;

const LOWER: &[u8] = b"abcdefghijklmnopqrstuvwxyz";
const UPPER: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS: &[u8] = b"0123456789";
const SYMBOLS: &[u8] = b"!@#$%^&*()-_=+[]{};:,.<>?/";

/// Word list for passphrase mode (kept small but offline & self-contained).
const WORDS: &[&str] = &[
    "Hund", "Katze", "Maus", "Adler", "Wolf", "Baer", "Fuchs", "Tiger", "Loewe", "Hai",
    "Blau", "Rot", "Gruen", "Gelb", "Schwarz", "Weiss", "Silber", "Gold", "Lila", "Cyan",
    "Mond", "Stern", "Sonne", "Komet", "Planet", "Galaxie", "Nebel", "Orbit", "Meteor", "Pulsar",
    "Berg", "Fluss", "Wald", "Ozean", "Wueste", "Insel", "Vulkan", "Gletscher", "Tal", "Klippe",
    "Sturm", "Donner", "Blitz", "Regen", "Schnee", "Nebel2", "Wind", "Frost", "Glut", "Welle",
    "Eisen", "Stahl", "Kupfer", "Quarz", "Diamant", "Granit", "Marmor", "Kristall", "Magnet", "Plasma",
];

#[derive(Debug, Clone, Deserialize)]
pub struct PasswordOptions {
    pub length: usize,
    pub uppercase: bool,
    pub lowercase: bool,
    pub digits: bool,
    pub symbols: bool,
    #[serde(default)]
    pub passphrase: bool,
    #[serde(default = "default_words")]
    pub word_count: usize,
    #[serde(default = "default_separator")]
    pub separator: String,
}

fn default_words() -> usize {
    4
}
fn default_separator() -> String {
    "-".into()
}

#[derive(Debug, Clone, Serialize)]
pub struct StrengthResult {
    /// 0..=4 (very weak .. very strong), zxcvbn-style scale.
    pub score: u8,
    pub entropy_bits: f64,
    pub label: String,
}

/// Uniformly pick an index in `0..max` from CSPRNG bytes (rejection sampling
/// to avoid modulo bias).
fn uniform_index(max: usize) -> usize {
    debug_assert!(max > 0);
    if max == 1 {
        return 0;
    }
    let zone = (u32::MAX / max as u32) * max as u32;
    loop {
        let b = crypto::random_bytes(4);
        let v = u32::from_le_bytes([b[0], b[1], b[2], b[3]]);
        if v < zone {
            return (v % max as u32) as usize;
        }
    }
}

pub fn generate(opts: &PasswordOptions) -> Result<String, String> {
    if opts.passphrase {
        return Ok(generate_passphrase(opts));
    }

    let mut pool: Vec<u8> = Vec::new();
    let mut required: Vec<&[u8]> = Vec::new();
    if opts.lowercase {
        pool.extend_from_slice(LOWER);
        required.push(LOWER);
    }
    if opts.uppercase {
        pool.extend_from_slice(UPPER);
        required.push(UPPER);
    }
    if opts.digits {
        pool.extend_from_slice(DIGITS);
        required.push(DIGITS);
    }
    if opts.symbols {
        pool.extend_from_slice(SYMBOLS);
        required.push(SYMBOLS);
    }

    if pool.is_empty() {
        return Err("select at least one character set".into());
    }
    let length = opts.length.clamp(8, 128);
    if length < required.len() {
        return Err("length too short for the selected character sets".into());
    }

    let mut chars: Vec<u8> = Vec::with_capacity(length);
    // Guarantee at least one char from each selected set.
    for set in &required {
        chars.push(set[uniform_index(set.len())]);
    }
    while chars.len() < length {
        chars.push(pool[uniform_index(pool.len())]);
    }
    // Fisher–Yates shuffle so the guaranteed chars aren't at fixed positions.
    for i in (1..chars.len()).rev() {
        let j = uniform_index(i + 1);
        chars.swap(i, j);
    }

    String::from_utf8(chars).map_err(|_| "generation produced invalid utf8".into())
}

fn generate_passphrase(opts: &PasswordOptions) -> String {
    let count = opts.word_count.clamp(3, 12);
    let sep = if opts.separator.is_empty() {
        "-"
    } else {
        &opts.separator
    };
    let mut parts: Vec<String> = (0..count)
        .map(|_| WORDS[uniform_index(WORDS.len())].to_string())
        .collect();
    // Append a 2-digit number for a bit more entropy (e.g. Hund-Blau-Mond-42).
    let num = uniform_index(90) + 10;
    parts.push(num.to_string());
    parts.join(sep)
}

/// Estimate strength from character-class diversity and length.
pub fn estimate_strength(password: &str) -> StrengthResult {
    if password.is_empty() {
        return StrengthResult {
            score: 0,
            entropy_bits: 0.0,
            label: "leer".into(),
        };
    }
    let mut pool = 0usize;
    if password.chars().any(|c| c.is_ascii_lowercase()) {
        pool += 26;
    }
    if password.chars().any(|c| c.is_ascii_uppercase()) {
        pool += 26;
    }
    if password.chars().any(|c| c.is_ascii_digit()) {
        pool += 10;
    }
    if password.chars().any(|c| !c.is_ascii_alphanumeric()) {
        pool += 32;
    }
    let pool = pool.max(1);
    let entropy = (password.chars().count() as f64) * (pool as f64).log2();

    let (score, label) = match entropy as u32 {
        0..=27 => (0u8, "sehr schwach"),
        28..=45 => (1, "schwach"),
        46..=63 => (2, "ok"),
        64..=99 => (3, "stark"),
        _ => (4, "sehr stark"),
    };
    StrengthResult {
        score,
        entropy_bits: entropy,
        label: label.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_opts() -> PasswordOptions {
        PasswordOptions {
            length: 20,
            uppercase: true,
            lowercase: true,
            digits: true,
            symbols: true,
            passphrase: false,
            word_count: 4,
            separator: "-".into(),
        }
    }

    #[test]
    fn respects_length() {
        let p = generate(&base_opts()).unwrap();
        assert_eq!(p.chars().count(), 20);
    }

    #[test]
    fn contains_each_required_class() {
        let p = generate(&base_opts()).unwrap();
        assert!(p.chars().any(|c| c.is_ascii_lowercase()));
        assert!(p.chars().any(|c| c.is_ascii_uppercase()));
        assert!(p.chars().any(|c| c.is_ascii_digit()));
        assert!(p.chars().any(|c| !c.is_ascii_alphanumeric()));
    }

    #[test]
    fn errors_when_no_set_selected() {
        let mut o = base_opts();
        o.uppercase = false;
        o.lowercase = false;
        o.digits = false;
        o.symbols = false;
        assert!(generate(&o).is_err());
    }

    #[test]
    fn generates_unique_passwords() {
        let a = generate(&base_opts()).unwrap();
        let b = generate(&base_opts()).unwrap();
        assert_ne!(a, b);
    }

    #[test]
    fn passphrase_has_word_count_plus_number() {
        let mut o = base_opts();
        o.passphrase = true;
        o.word_count = 4;
        let p = generate(&o).unwrap();
        assert_eq!(p.split('-').count(), 5); // 4 words + number
    }

    #[test]
    fn strength_increases_with_complexity() {
        let weak = estimate_strength("aaaa");
        let strong = estimate_strength("X9$kL2@mQ7!pZ4&w");
        assert!(strong.score > weak.score);
    }
}
