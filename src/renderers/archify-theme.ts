import type { ClearcodeTheme } from '../themes/model.js';
import { palettes } from './archify/upstream/palette.mjs';

/** Palette and card treatment adapted from the pinned Archify classic light/dark presets. */
export function archifyTheme(theme: ClearcodeTheme): ClearcodeTheme {
  const dark = theme.colorScheme === 'dark';
  const canvas = dark ? '#020617' : '#f4f5f7', panel = dark ? '#0f172a' : '#ffffff';
  const ink = dark ? '#ffffff' : '#111827', muted = dark ? '#94a3b8' : '#5b6474';
  const border = dark ? '#334155' : '#cbd5e1', line = dark ? '#94a3b8' : '#64748b';
  const font = "'JetBrains Mono', 'Cascadia Code', 'SFMono-Regular', Consolas, 'Microsoft YaHei', monospace";
  return {
    ...theme,
    variables: {
      ...theme.variables,
      ...palettes[dark ? 'dark' : 'light'],
      '--ccv-bg': panel, '--ccv-canvas': canvas, '--ccv-soft': dark ? '#162236' : '#eef2f7',
      '--ccv-text': ink, '--ccv-muted': muted, '--ccv-border': border,
      '--ccv-accent': dark ? '#22d3ee' : '#0891b2', '--ccv-radius': '12px', '--ccv-font': font,
      '--ccv-dot': dark ? '#33415566' : '#cbd5e177',
      '--ccv-frontend': dark ? '#22d3ee' : '#0891b2', '--ccv-backend': dark ? '#34d399' : '#059669',
      '--ccv-database': dark ? '#a78bfa' : '#7c3aed', '--ccv-cloud': dark ? '#fbbf24' : '#d97706',
      '--ccv-security': dark ? '#fb7185' : '#e11d48', '--ccv-messagebus': dark ? '#fb923c' : '#ea580c',
      '--ccv-external': dark ? '#94a3b8' : '#64748b',
    },
    mermaid: {
      theme: 'base', look: 'classic', themeVariables: {
        darkMode: dark, fontFamily: font, fontSize: '15px', background: canvas,
        primaryColor: panel, primaryTextColor: ink, primaryBorderColor: line, lineColor: line, textColor: ink,
        secondaryColor: dark ? '#162236' : '#eef2f7', secondaryTextColor: ink, secondaryBorderColor: border,
        tertiaryColor: canvas, tertiaryTextColor: ink, tertiaryBorderColor: border,
        mainBkg: panel, nodeBorder: line, clusterBkg: panel, clusterBorder: border, edgeLabelBackground: panel,
        actorBkg: panel, actorBorder: line, actorTextColor: ink, actorLineColor: line,
        signalColor: line, signalTextColor: ink, activationBkgColor: panel, activationBorderColor: line,
        labelBoxBkgColor: panel, labelBoxBorderColor: border, labelTextColor: ink, loopTextColor: ink,
        noteBkgColor: panel, noteBorderColor: border, noteTextColor: ink, sequenceNumberColor: panel,
        attributeBackgroundColorOdd: panel, attributeBackgroundColorEven: dark ? '#162236' : '#eef2f7',
      },
    },
  };
}
