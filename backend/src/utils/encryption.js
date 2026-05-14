// ============================================================
// AES-256-GCM Encryption for Sensitive Data (tokens, secrets)
// ============================================================
// Stores as: iv:authTag:ciphertext (hex-encoded, colon-separated)
// Gracefully handles plaintext for backward compatibility.

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_PATTERN = /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/;

function _getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) return null;
  // Derive a 32-byte key from the env var using SHA-256
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a plaintext string. Returns the encrypted string or the original if no key is configured.
 */
function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  const key = _getKey();
  if (!key) return plaintext; // no key = store as-is (dev mode)

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an encrypted string. Gracefully returns the original if it's not encrypted (backward compat).
 */
function decrypt(ciphertext) {
  if (!ciphertext) return ciphertext;

  // If it doesn't match the encrypted pattern, it's plaintext (backward compat)
  if (!ENCRYPTED_PATTERN.test(ciphertext)) return ciphertext;

  const key = _getKey();
  if (!key) return ciphertext; // can't decrypt without key

  try {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // If decryption fails, return as-is (might be a different format)
    return ciphertext;
  }
}

module.exports = { encrypt, decrypt };
