import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Encrypt a string using AES-256-GCM.
 * Returns a base64 string of: iv (12 bytes) + authTag (16 bytes) + ciphertext.
 */
export function encrypt(plaintext: string, secretKey?: string): string {
  const key = Buffer.from(
    (secretKey || process.env.BETTER_AUTH_SECRET || process.env.SESSION_SECRET || '').padEnd(32, '0').slice(0, 32),
    'utf-8'
  );
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt a base64 string produced by encrypt().
 */
export function decrypt(encryptedBase64: string, secretKey?: string): string {
  const key = Buffer.from(
    (secretKey || process.env.BETTER_AUTH_SECRET || process.env.SESSION_SECRET || '').padEnd(32, '0').slice(0, 32),
    'utf-8'
  );
  const data = Buffer.from(encryptedBase64, 'base64');
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final('utf-8');
}
