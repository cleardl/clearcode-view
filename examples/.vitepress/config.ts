import { defineConfig } from 'vitepress';
import { fileURLToPath } from 'node:url';
import { clearcodeViewConfig } from '../../src/integrations/vitepress/config.js';

const base = clearcodeViewConfig({ root: fileURLToPath(new URL('..', import.meta.url)) });

export default defineConfig({
  ...base,
  description: 'Markdown、Mermaid 与可交互的技术解读',
  vite: { ...base.vite, server: { fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } } },
});
