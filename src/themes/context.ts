import type { InjectionKey } from 'vue';
import type { ClearcodeViewOptions } from './model.js';

/** Only Vue integration uses this key; the protocol parser has no theme dependency. */
export const themeOptionsKey: InjectionKey<ClearcodeViewOptions> = Symbol('clearcode-view themes');
