/**
 * Device identification for Settings → Devices (server-side, no React).
 *
 * A User-Agent is parsed into { type, os, browser }, from which a default
 * device name ("Chrome · Windows") and icon are derived at login. The icon
 * KEYS are shared with the client-side icon picker (components/SettingsPage)
 * and persisted on the Session row — keep both sides in sync.
 */

export const DEVICE_ICON_KEYS = [
  "monitor", "laptop", "smartphone", "tablet", "watch",
  "tv", "gamepad", "headphones", "briefcase", "home",
] as const;

export type DeviceIcon = (typeof DEVICE_ICON_KEYS)[number];

export function isDeviceIcon(value: string): value is DeviceIcon {
  return (DEVICE_ICON_KEYS as readonly string[]).includes(value);
}

export type DeviceType = "desktop" | "tablet" | "mobile";
export type DeviceDescriptor = { type: DeviceType; os: string; browser: string };

/** Best-effort UA sniffing — only used for the DEFAULT name/icon; the
 *  visitor can rename and re-icon the device freely in Settings. */
export function describeUserAgent(ua: string | null | undefined): DeviceDescriptor {
  const s = ua ?? "";
  const tablet = /iPad|Tablet|PlayBook|Silk/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s));
  const mobile = !tablet && /Mobi|iPhone|iPod|Android|Windows Phone/i.test(s);
  const type: DeviceType = tablet ? "tablet" : mobile ? "mobile" : "desktop";
  const os = /Windows/i.test(s) ? "Windows"
    : /iPhone|iPad|iPod/i.test(s) ? "iOS"
    : /Macintosh|Mac OS X/i.test(s) ? "macOS"
    : /Android/i.test(s) ? "Android"
    : /Linux|X11/i.test(s) ? "Linux"
    : "";
  const browser = /Edg\//i.test(s) ? "Edge"
    : /OPR\/|Opera/i.test(s) ? "Opera"
    : /Chromium/i.test(s) ? "Chromium"
    : /Chrome\//i.test(s) ? "Chrome"
    : /Firefox\//i.test(s) ? "Firefox"
    : /Safari\//i.test(s) ? "Safari"
    : "";
  return { type, os, browser };
}

/** "Chrome · Windows" / "Safari · iPhone" — brand names stay Latin. */
export function defaultDeviceName(ua: string | null | undefined): string {
  const d = describeUserAgent(ua);
  const parts = [d.browser, d.os].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return d.type === "mobile" ? "Mobile" : d.type === "tablet" ? "Tablet" : "Desktop";
}

export function defaultDeviceIcon(ua: string | null | undefined): DeviceIcon {
  const { type } = describeUserAgent(ua);
  return type === "mobile" ? "smartphone" : type === "tablet" ? "tablet" : "monitor";
}
