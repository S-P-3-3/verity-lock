/** TS port of the Rust generator/strength logic, for the Android web backend. */
import type { PasswordOptions, StrengthResult } from "../types";
import { randomBytes } from "./crypto";

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.<>?/";

const WORDS = [
  "Hund", "Katze", "Maus", "Adler", "Wolf", "Baer", "Fuchs", "Tiger", "Loewe", "Hai",
  "Blau", "Rot", "Gruen", "Gelb", "Schwarz", "Weiss", "Silber", "Gold", "Lila", "Cyan",
  "Mond", "Stern", "Sonne", "Komet", "Planet", "Galaxie", "Nebel", "Orbit", "Meteor", "Pulsar",
  "Berg", "Fluss", "Wald", "Ozean", "Wueste", "Insel", "Vulkan", "Gletscher", "Tal", "Klippe",
];

/** Unbiased index in [0, max) via rejection sampling on CSPRNG bytes. */
function uniform(max: number): number {
  if (max <= 1) return 0;
  const zone = Math.floor(0xffffffff / max) * max;
  for (;;) {
    const b = randomBytes(4);
    const v = (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
    if (v < zone) return v % max;
  }
}

export function generatePassword(opts: PasswordOptions): string {
  if (opts.passphrase) {
    const count = Math.min(Math.max(opts.word_count, 3), 12);
    const sep = opts.separator || "-";
    const parts: string[] = [];
    for (let i = 0; i < count; i++) parts.push(WORDS[uniform(WORDS.length)]);
    parts.push(String(uniform(90) + 10));
    return parts.join(sep);
  }

  let pool = "";
  const required: string[] = [];
  if (opts.lowercase) { pool += LOWER; required.push(LOWER); }
  if (opts.uppercase) { pool += UPPER; required.push(UPPER); }
  if (opts.digits) { pool += DIGITS; required.push(DIGITS); }
  if (opts.symbols) { pool += SYMBOLS; required.push(SYMBOLS); }
  if (!pool) throw new Error("Mindestens eine Zeichengruppe wählen");

  const length = Math.min(Math.max(opts.length, 8), 128);
  if (length < required.length) throw new Error("Länge zu kurz für die gewählten Gruppen");

  const chars: string[] = [];
  for (const set of required) chars.push(set[uniform(set.length)]);
  while (chars.length < length) chars.push(pool[uniform(pool.length)]);
  // Fisher–Yates shuffle.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = uniform(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export function estimateStrength(password: string): StrengthResult {
  if (!password) return { score: 0, entropy_bits: 0, label: "leer" };
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(password)) pool += 32;
  pool = Math.max(pool, 1);
  const entropy = password.length * Math.log2(pool);
  let score = 0;
  let label = "sehr schwach";
  if (entropy >= 100) { score = 4; label = "sehr stark"; }
  else if (entropy >= 64) { score = 3; label = "stark"; }
  else if (entropy >= 46) { score = 2; label = "ok"; }
  else if (entropy >= 28) { score = 1; label = "schwach"; }
  return { score, entropy_bits: entropy, label };
}
