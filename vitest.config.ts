import { defineConfig } from 'vite';
import type { InlineConfig } from 'vitest/node';
import vue from '@vitejs/plugin-vue';

const config = {
  plugins: [vue()],
  test: { include: ['tests/**/*.test.ts'], environment: 'node' } satisfies InlineConfig,
};
export default defineConfig(config);
