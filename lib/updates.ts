export const UPDATE_MANIFEST_URL = 'https://raw.githubusercontent.com/greddmbamboo/signal-template/main/release.json';
export const UPDATE_GUIDE_URL = 'https://raw.githubusercontent.com/greddmbamboo/signal-template/main/UPDATE-SIGNAL.md';
const repository = 'https://github.com/greddmbamboo/signal-template';
export function versionParts(version: unknown): number[] | null {
  if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) return null;
  const parts = version.split('.').map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}
export function isNewerVersion(candidate: string, current: string): boolean {
  const next = versionParts(candidate), installed = versionParts(current);
  if (!next || !installed) return false;
  for (let i = 0; i < 3; i++) { if (next[i] !== installed[i]) return next[i] > installed[i]; }
  return false;
}
export type SignalRelease = { version: string; notesUrl: string };
export async function checkForUpdate(signal: AbortSignal): Promise<SignalRelease> {
  // Fixed public URL; no identity, installed version, cookies, or app data sent.
  const response = await fetch(UPDATE_MANIFEST_URL, { signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-cache', redirect: 'error' });
  if (!response.ok) throw new Error('Update check unavailable');
  const text = await response.text();
  if (text.length > 4096) throw new Error('Invalid release metadata');
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || !('version' in value) || !versionParts(value.version)) throw new Error('Invalid release version');
  const version = value.version as string;
  // Do not trust remote link fields or render remote HTML.
  return { version, notesUrl: `${repository}/releases/tag/v${version}` };
}
