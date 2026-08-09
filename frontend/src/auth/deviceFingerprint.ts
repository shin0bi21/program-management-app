const DEVICE_ID_KEY = 'device_id';

function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export function getDeviceFingerprint(): string {
  return `${getDeviceId()}|${navigator.userAgent}`;
}

export function getDeviceName(): string {
  const userAgent = navigator.userAgent;

  let browser = 'Unknown Browser';
  if (userAgent.includes('Edg/')) browser = 'Edge';
  else if (userAgent.includes('Firefox/')) browser = 'Firefox';
  else if (userAgent.includes('Chrome/')) browser = 'Chrome';
  else if (userAgent.includes('Safari/')) browser = 'Safari';

  let operatingSystem = 'Unknown OS';
  if (/iPhone|iPad|iPod/.test(userAgent)) operatingSystem = 'iOS';
  else if (userAgent.includes('Android')) operatingSystem = 'Android';
  else if (userAgent.includes('Windows')) operatingSystem = 'Windows';
  else if (userAgent.includes('Mac')) operatingSystem = 'macOS';
  else if (userAgent.includes('Linux')) operatingSystem = 'Linux';

  return `${browser} on ${operatingSystem}`;
}
