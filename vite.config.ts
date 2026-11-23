import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import packageMetadata from './package.json' with { type: 'json' };

const { dependencies } = packageMetadata;

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: { index: 'src/index.ts', core: 'src/core.ts', mermaid: 'src/mermaid.ts', renderers: 'src/renderers.ts', vue: 'src/vue.ts', vitepress: 'src/vitepress.ts', 'vitepress-theme': 'src/vitepress-theme.ts', themes: 'src/themes.ts' },
      formats: ['es'],
      fileName: (_format, entry) => `${entry}.js`,
      cssFileName: 'style',
    },
    rollupOptions: {
      external: id => id.startsWith('node:') || ['vue', 'vitepress', ...Object.keys(dependencies)].some(name => id === name || id.startsWith(name + '/')),
    },
  },
});
