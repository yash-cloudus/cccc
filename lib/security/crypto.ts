/**
 * Symmetric encryption for provider credentials stored in the database
 * (`CommunityIntegration.*Enc`).
 *
 * Node's built-in `crypto`, AES-256-GCM — no dependency, and GCM's auth tag
 * means a tampered or truncated row fails loudly instead of decrypting to
 * garbage that gets sent to a provider.
 *
 * This is NOT for passwords. Passwords are bcrypt one-way hashes
 * (`User.passwordHash`). These values have to be read back to call an API, so
 * they must be reversible — which is exactly why they live in their own table
 * and never reach the browser.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard
const VERSION = "v1";

/**
 * 32-byte key from `ENCRYPTION_KEY`.
 *
 * SHA-256 normalises any passphrase to the length AES needs — it does NOT
 * stretch it, so a weak passphrase is a weak key. Generate with
 * `openssl rand -base64 32`.
 *
 * Deliberately its own variable, not derived from `JWT_ACCESS_SECRET`: rotating
 * a JWT secret is routine and would silently destroy every stored credential.
 */
function key(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || "";
  if (secret.length < 32) {
    throw new Error("Missing ENCRYPTION_KEY (min 32 chars) — cannot store integration credentials");
  }
  return createHash("sha256").update(secret).digest();
}

/**
 * `v1.<iv>.<tag>.<ciphertext>`, each part base64.
 *
 * `.` is not in the base64 alphabet, so splitting on it is unambiguous. The
 * version prefix leaves room to introduce a second key generation later without
 * a schema change.
 */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(".");
}

export function decryptSecret(stored: string): string {
  const [version, ivB64, tagB64, ctB64] = (stored || "").split(".");
  if (version !== VERSION || !ivB64 || !tagB64 || !ctB64) {
    throw new Error("Stored secret is not in the expected format");
  }
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

/** `decryptSecret` that returns null instead of throwing — for read paths that
 *  must not 500 when a row predates a key rotation. */
export function tryDecryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    return decryptSecret(stored);
  } catch {
    return null;
  }
}

/**
 * What the Main Admin sees instead of a saved credential — enough to recognise
 * which key is in there, not enough to use it.
 */
export function maskSecret(plain: string | null | undefined): string | null {
  if (!plain) return null;
  return "••••••" + plain.slice(-4);
}
