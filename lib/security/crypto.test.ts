/**
 * Round-trip and tamper-detection for stored provider credentials.
 * Run: npx tsx lib/security/crypto.test.ts
 */
import assert from "node:assert";
import { decryptSecret, encryptSecret, maskSecret, tryDecryptSecret } from "./crypto";

// Read at call time, not import time — so setting it here is enough.
process.env.ENCRYPTION_KEY = "test-key-that-is-at-least-32-chars-long";

// Round trip.
const plain = "arthix_live_abc123456789";
assert.equal(decryptSecret(encryptSecret(plain)), plain);

// Fresh IV every call, so the same plaintext never produces the same row —
// otherwise equal ciphertexts would leak that two communities share a key.
assert.notEqual(encryptSecret(plain), encryptSecret(plain));

// GCM's auth tag catches tampering rather than returning garbage.
const ct = encryptSecret(plain);
assert.throws(() => decryptSecret(ct.slice(0, -4) + "AAAA"));
assert.throws(() => decryptSecret("not-a-ciphertext"));
assert.throws(() => decryptSecret(""));

// A wrong key fails closed, and the null-returning variant swallows it.
assert.equal(tryDecryptSecret(ct), plain);
assert.equal(tryDecryptSecret(null), null);
process.env.ENCRYPTION_KEY = "a-completely-different-key-32-chars-min";
assert.equal(tryDecryptSecret(ct), null);
process.env.ENCRYPTION_KEY = "test-key-that-is-at-least-32-chars-long";

// A short key is refused outright — a 4-char "secret" must not silently work.
process.env.ENCRYPTION_KEY = "short";
assert.throws(() => encryptSecret("x"), /ENCRYPTION_KEY/);
process.env.ENCRYPTION_KEY = "test-key-that-is-at-least-32-chars-long";

assert.equal(maskSecret("arthix_live_abc123456789"), "••••••6789");
assert.equal(maskSecret(null), null);
assert.equal(maskSecret(""), null);

console.log("ok");
