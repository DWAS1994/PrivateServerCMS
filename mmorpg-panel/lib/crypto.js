// AES-256-GCM helpers for storing sensitive config (game DB password) at rest.
//
// The key is derived from SESSION_SECRET (which is already required to be at
// least 32 chars), so no additional setup is needed. Note: changing
// SESSION_SECRET will make previously-encrypted values unrecoverable — you'd
// have to re-enter the game DB password in the admin panel.
import crypto from "crypto";

function getKey() {
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 16) {
    throw new Error("SESSION_SECRET must be set (at least 16 chars) to use encryption");
  }
  // Derive a stable 32-byte key from SESSION_SECRET
  return crypto.createHash("sha256").update(secret).digest();
}

export function encrypt(plain) {
  if (plain === null || plain === undefined || plain === "") return "";
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Encode as: base64(iv) . base64(tag) . base64(ciphertext)
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decrypt(blob) {
  if (!blob) return "";
  const parts = String(blob).split(".");
  if (parts.length !== 3) return "";
  try {
    const [ivB64, tagB64, encB64] = parts;
    const key = getKey();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(encB64, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch (e) {
    // Tampered, wrong key, or just a bad value
    return "";
  }
}
