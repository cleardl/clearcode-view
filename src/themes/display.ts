import { inject, readonly, ref, type InjectionKey, type Ref } from 'vue';
import type { DiagramRenderer } from '../renderers/model.js';

/** One host-owned presentation choice shared by every diagram in the app. */
export interface DisplayPreferences {
  renderers: readonly DiagramRenderer[];
  rendererId: Readonly<Ref<string>>;
  colorScheme: Readonly<Ref<'light' | 'dark' | undefined>>;
  initialize(): Promise<void>;
  selectRenderer(id: string): void;
  followColorScheme(scheme: 'light' | 'dark'): void;
  dispose(): void;
}

export const displayPreferencesKey: InjectionKey<DisplayPreferences> = Symbol('clearcode-view display preferences');

/** Create app-local state; browser persistence starts after synchronous mounting and hydration. */
export function createDisplayPreferences(renderers: DiagramRenderer[], initialRenderer: string, preferenceKey: string | false = 'clearcode-view:renderer'): DisplayPreferences {
  const rendererId = ref(initialRenderer), colorScheme = ref<'light' | 'dark'>();
  let initialization: Promise<void> | undefined, disposed = false, storage: Storage | undefined;
  const registered = (id: string | null): id is string => id !== null && renderers.some(renderer => renderer.id === id);
  function changed(event: StorageEvent) {
    if (event.storageArea !== storage || event.key !== preferenceKey && event.key !== null) return;
    rendererId.value = registered(event.newValue) ? event.newValue : initialRenderer;
  }
  return {
    renderers, rendererId: readonly(rendererId), colorScheme: readonly(colorScheme),
    initialize() {
      initialization ??= Promise.resolve().then(() => {
        if (disposed || preferenceKey === false || typeof window === 'undefined') return;
        try {
          storage = window.localStorage;
          const saved = storage.getItem(preferenceKey);
          if (registered(saved)) rendererId.value = saved;
          window.addEventListener('storage', changed);
        } catch (error) { console.warn('图表风格无法读取浏览器存储，将使用当前设置。', error); }
      });
      return initialization;
    },
    selectRenderer(id) {
      if (!registered(id)) throw new Error(`展示风格不存在：${id}`);
      rendererId.value = id;
      if (storage && preferenceKey !== false) {
        try { storage.setItem(preferenceKey, id); }
        catch (error) { console.warn('图表风格无法保存，当前页面仍会使用此设置。', error); }
      }
    },
    followColorScheme(scheme) { colorScheme.value = scheme; },
    dispose() { disposed = true; if (typeof window !== 'undefined') window.removeEventListener('storage', changed); },
  };
}

/** Access the shared settings registered by clearcodeViewPlugin from a host layout. */
export function useDisplayPreferences(): DisplayPreferences {
  const preferences = inject(displayPreferencesKey);
  if (!preferences) throw new Error('全局图表设置需要先注册 clearcodeViewPlugin');
  return preferences;
}
