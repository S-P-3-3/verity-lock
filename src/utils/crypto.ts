/**
 * Web Crypto vault encryption for the Android/Capacitor build.
 *
 * KDF:        PBKDF2-HMAC-SHA-256, 210 000 iterations  (browsers have no Argon2)
 * Cipher:     AES-256-GCM
 * Blob layout: salt(16) | iv(12) | ciphertext+tag      (all bytes, then base64)
 *
 * NOTE: This is intentionally different from the desktop Rust vault (Argon2id +
 * `.sp3vault` magic header). Vaults are therefore NOT interchangeable between
 * desktop and Android — each platform reads its own format.
 */

const SALT_LEN = 16;
const IV_LEN = 12;
const PBKDF2_ITERATIONS = 210_000;

export function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

/** 16 cryptographically random digits (the account number). */
export function generateAccountNumber(): string {
  const out: number[] = [];
  while (out.length < 16) {
    for (const b of randomBytes(16)) {
      if (b < 250) {
        // unbiased: floor(256/10)*10 = 250
        out.push(b % 10);
        if (out.length === 16) break;
      }
    }
  }
  return out.join("");
}

async function deriveKey(accountNumber: string, salt: Uint8Array): Promise<CryptoKey> {
  const normalized = accountNumber.replace(/\D/g, "");
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(normalized),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptVault(data: unknown, accountNumber: string): Promise<Uint8Array> {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = await deriveKey(accountNumber, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));

  const blob = new Uint8Array(SALT_LEN + IV_LEN + ct.byteLength);
  blob.set(salt, 0);
  blob.set(iv, SALT_LEN);
  blob.set(ct, SALT_LEN + IV_LEN);
  return blob;
}

export async function decryptVault<T = unknown>(blob: Uint8Array, accountNumber: string): Promise<T> {
  if (blob.byteLength < SALT_LEN + IV_LEN + 16) throw new Error("Vault beschädigt");
  const salt = blob.slice(0, SALT_LEN);
  const iv = blob.slice(SALT_LEN, SALT_LEN + IV_LEN);
  const ct = blob.slice(SALT_LEN + IV_LEN);
  const key = await deriveKey(accountNumber, salt);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  } catch {
    throw new Error("Falsche Kontonummer");
  }
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

// --- base64 helpers (binary-safe) ------------------------------------------

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
