import crypto from 'crypto';

/**
 * Hash a device fingerprint using SHA-256
 * @param fingerprint - Device fingerprint string (e.g., "uuid|user-agent")
 * @returns Hashed fingerprint as hex string
 */
export const hashDeviceFingerprint = (fingerprint: string): string => {
  return crypto
    .createHash('sha256')
    .update(fingerprint)
    .digest('hex');
};
