import type { App, Plugin } from 'vue';
import DiagramView from './components/DiagramView.vue';
import { themeOptionsKey } from './themes/context.js';
import { defaultThemes } from './themes/presets.js';
import type { ClearcodeViewOptions } from './themes/model.js';
import { archifyRenderer } from './renderers/archify.js';
import { createDisplayPreferences, displayPreferencesKey } from './themes/display.js';
import DiagramStyleSelect from './components/DiagramStyleSelect.vue';

export { DiagramView, DiagramStyleSelect };
export { useDisplayPreferences } from './themes/display.js';
export type { DisplayPreferences } from './themes/display.js';

/** Register the component emitted by the Markdown integration. */
export const clearcodeViewPlugin: Plugin<[ClearcodeViewOptions?]> = {
  install(app: App, options: ClearcodeViewOptions = {}) {
    const themes = options.themes ?? defaultThemes;
    if (!themes.length || new Set(themes.map(theme => theme.id)).size !== themes.length) throw new Error('图表主题不能为空或重复');
    if (options.theme && !themes.some(theme => theme.id === options.theme)) throw new Error(`图表主题不存在：${options.theme}`);
    const renderers = options.renderers ?? [options.renderer || archifyRenderer];
    if (!renderers.length || new Set(renderers.map(renderer => renderer.id)).size !== renderers.length) throw new Error('展示风格不能为空或重复');
    if (options.renderer && !renderers.some(renderer => renderer.id === options.renderer!.id)) throw new Error(`展示风格不存在：${options.renderer.id}`);
    app.provide(themeOptionsKey, { ...options, themes, renderers });
    const preferences = createDisplayPreferences(renderers, options.renderer?.id || renderers[0].id, options.preferenceKey);
    app.provide(displayPreferencesKey, preferences);
    app.onUnmount(preferences.dispose);
    app.component('ClearcodeDiagram', DiagramView);
  },
};
