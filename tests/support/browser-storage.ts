import { vi } from 'vitest';

/** Use jsdom's browser Storage rather than Node's process-level localStorage in Node 25. */
export function browserStorage(): () => void {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  vi.stubGlobal('localStorage', frame.contentWindow!.localStorage);
  window.localStorage.clear();
  return () => frame.remove();
}
