import crypto from "crypto";

// AES-256-GCM encryption for TOTP secrets stored in MongoDB.
//
// Storage format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
//
// The "v1" version prefix allows future key-rotation schemes without
// breaking existing records — a v2 reader can detect and re-wrap v1 records.
//
// Required env var: TOTP_ENCRYPTION_KEY — a 64-char hex string (32 bytes).
// Generate one with:
//   node -e "require('crypto').randomBytes(32).toString('hex')"

const ALGORITHM = "aes-256-gcm" as const;
const PREFIX = "enc:v1:";

function getKey(): Buffer {
    const keyHex = process.env.TOTP_ENCRYPTION_KEY;
    if (!keyHex) {
        throw new Error(
            "TOTP_ENCRYPTION_KEY is not set. " +
            "Generate one with: node -e \"require('crypto').randomBytes(32).toString('hex')\""
        );
    }
    const key = Buffer.from(keyHex, "hex");
    if (key.length !== 32) {
        throw new Error("TOTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).");
    }
    return key;
}

export function encryptTotpSecret(plaintext: string): string {
    const key = getKey();
    const iv = crypto.randomBytes(12); // 96-bit IV — NIST recommended for AES-GCM
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag(); // 128-bit authentication tag
    return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptTotpSecret(stored: string): string {
    if (!stored.startsWith(PREFIX)) {
        // Legacy plaintext secret (pre-encryption migration) — return as-is.
        // The caller should re-encrypt and persist the result.
        return stored;
    }
    const key = getKey();
    const raw = stored.slice(PREFIX.length).split(":");
    if (raw.length !== 3) throw new Error("Malformed encrypted TOTP secret.");

    const [ivHex, authTagHex, ciphertextHex] = raw;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function isEncryptedTotp(value: string): boolean {
    return value.startsWith(PREFIX);
}
