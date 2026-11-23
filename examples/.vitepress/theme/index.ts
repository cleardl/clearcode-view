import DefaultTheme from 'vitepress/theme';
import { useData, type Theme } from 'vitepress';
import { defineComponent, h, onMounted, watch } from 'vue';
import { clearcodeViewPlugin, DiagramStyleSelect, useDisplayPreferences } from '../../../src/vue.js';
import { VitePressSidebarResize } from '../../../src/vitepress-theme.js';
import { customRenderer, diagramDesignRenderer, createArchifyRenderer } from '../../../src/renderers.js';
import { archifyExamplePresentation } from '../archify-presentation.js';
import StandaloneDiagram from '../components/StandaloneDiagram.vue';

export default {
  extends: DefaultTheme,
  Layout: defineComponent({
    setup() {
      const { isDark } = useData(), preferences = useDisplayPreferences();
      onMounted(() => preferences.followColorScheme(isDark.value ? 'dark' : 'light'));
      watch(isDark, dark => preferences.followColorScheme(dark ? 'dark' : 'light'));
      return () => h(DefaultTheme.Layout, { class: 'ccv-vitepress' }, {
        'nav-bar-content-after': () => h(DiagramStyleSelect),
        'layout-bottom': () => h(VitePressSidebarResize),
      });
    },
  }),
  enhanceApp({ app }) { app.use(clearcodeViewPlugin, { renderers: [createArchifyRenderer(archifyExamplePresentation), customRenderer, diagramDesignRenderer] }); app.component('StandaloneDiagram', StandaloneDiagram); },
} satisfies Theme;
