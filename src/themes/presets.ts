import type { ClearcodeTheme } from './model.js';

/** A light reading surface with Mermaid's maintained Neo/color rendering. */
export const studioTheme: ClearcodeTheme = {
  id: 'studio', label: 'Studio · 浅色', colorScheme: 'light',
  variables: {
    '--ccv-bg': '#ffffff', '--ccv-soft': '#f2f5fa', '--ccv-text': '#23334a', '--ccv-muted': '#60718a',
    '--ccv-border': '#dce4ef', '--ccv-accent': '#2563c7', '--ccv-canvas': '#f8fafd', '--ccv-dot': '#c4d1e550',
    '--ccv-frontend': '#2563c7', '--ccv-backend': '#157b65', '--ccv-database': '#7950bc',
    '--ccv-security': '#bd405f', '--ccv-messagebus': '#a66a16', '--ccv-cloud': '#087d96', '--ccv-external': '#64748b',
    '--ccv-radius': '16px', '--ccv-font': "Inter, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  mermaid: { theme: 'redux-color', look: 'neo', themeVariables: { fontSize: '15px' } },
};

/** The same document can use a dark technical drawing surface. */
export const blueprintTheme: ClearcodeTheme = {
  id: 'blueprint', label: 'Blueprint · 深色', colorScheme: 'dark',
  variables: {
    '--ccv-bg': '#142135', '--ccv-soft': '#192a40', '--ccv-text': '#e2ebf6', '--ccv-muted': '#9eafc5',
    '--ccv-border': '#30435e', '--ccv-accent': '#7cb8ff', '--ccv-canvas': '#101c2e', '--ccv-dot': '#6982a336',
    '--ccv-frontend': '#7cb8ff', '--ccv-backend': '#66d7b4', '--ccv-database': '#bea0f8',
    '--ccv-security': '#ff94ae', '--ccv-messagebus': '#f0c168', '--ccv-cloud': '#6bd0e3', '--ccv-external': '#a1b2c8',
    '--ccv-radius': '8px', '--ccv-font': "'Cascadia Code', 'SFMono-Regular', Consolas, 'Microsoft YaHei', monospace",
  },
  mermaid: { theme: 'redux-dark-color', look: 'neo', themeVariables: { fontSize: '15px' } },
};

export const defaultThemes: ClearcodeTheme[] = [studioTheme, blueprintTheme];
