/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDisplayPreferences, type DisplayPreferences } from '../../src/themes/display.js';
import type { DiagramRenderer } from '../../src/renderers/model.js';
import { browserStorage } from '../support/browser-storage.js';

const renderers: DiagramRenderer[] = ['custom', 'archify'].map(id => ({ id, label: id, supports: () => true, render: async () => { throw new Error('Not used in preference tests'); } }));
const states: DisplayPreferences[] = [];
let removeStorageFrame: () => void;
beforeEach(() => { removeStorageFrame = browserStorage(); });
afterEach(() => { for (const state of states.splice(0)) state.dispose(); removeStorageFrame(); vi.unstubAllGlobals(); });
function preferences(key: string | false = 'clearcode-view:renderer') { const state = createDisplayPreferences(renderers, 'custom', key); states.push(state); return state; }

describe('app-wide display preferences', () => {
  it('restores and saves the registered renderer across a fresh app instance', async () => {
    const first = preferences(); await first.initialize(); first.selectRenderer('archify'); first.dispose();
    const next = preferences(); await next.initialize();
    expect(next.rendererId.value).toBe('archify');
    expect(next.colorScheme.value).toBeUndefined();
    next.followColorScheme('dark');
    expect(next.colorScheme.value).toBe('dark');
    expect(window.localStorage.getItem('clearcode-view:renderer')).toBe('archify');
  });

  it('ignores a saved renderer removed from the registry and rejects unknown choices', async () => {
    window.localStorage.setItem('clearcode-view:renderer', 'removed');
    const state = preferences(); await state.initialize();
    expect(state.rendererId.value).toBe('custom');
    expect(() => state.selectRenderer('removed')).toThrow(/不存在/);
  });

  it('updates other tabs through browser storage events and stops listening when the app unmounts', async () => {
    const state = preferences(); await state.initialize();
    const update = (value: string) => window.dispatchEvent(new StorageEvent('storage', { key: 'clearcode-view:renderer', storageArea: window.localStorage, newValue: value }));
    update('archify'); expect(state.rendererId.value).toBe('archify');
    state.dispose(); update('custom'); expect(state.rendererId.value).toBe('archify');
  });

  it('keeps app state isolated when persistence is disabled', async () => {
    const first = preferences(false), second = preferences(false);
    await Promise.all([first.initialize(), second.initialize()]);
    first.selectRenderer('archify');
    expect(second.rendererId.value).toBe('custom');
    expect(window.localStorage.getItem('clearcode-view:renderer')).toBeNull();
  });
});
