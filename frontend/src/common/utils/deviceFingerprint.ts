const DEVICE_ID_KEY = 'device_id';

/**
 * Gets or creates a persistent device ID stored in localStorage
 */
function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    // Generate random UUID using browser crypto API
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
}

/**
 * Generates a device fingerprint string from User-Agent and device ID
 * Backend will hash this for secure storage
 */
export function getDeviceFingerprint(): string {
  const deviceId = getDeviceId();
  const userAgent = navigator.userAgent;
  
  // Combine device ID and user agent
  // Backend will hash this with crypto
  return `${deviceId}|${userAgent}`;
}

/**
 * Gets a human-readable device name for display
 */
export function getDeviceName(): string {
  const ua = navigator.userAgent;
  
  // Detect browser
  let browser = 'Unknown Browser';
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  
  // Detect OS
  let os = 'Unknown OS';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS')) os = 'iOS';
  
  return `${browser} on ${os}`;
}
