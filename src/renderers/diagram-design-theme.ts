import type { ClearcodeTheme } from '../themes/model.js';

/** Diagram Design's editorial tokens, derived from the host's explicit light/dark choice. */
export function diagramDesignTheme(theme: ClearcodeTheme): ClearcodeTheme {
  const dark = theme.colorScheme === 'dark';
  const paper = dark ? '#2d3142' : '#f5f5f5', surface = dark ? '#393e53' : '#ececec';
  const ink = dark ? '#f5f5f5' : '#2d3142', muted = dark ? '#bfc0c0' : '#4f5d75';
  const soft = dark ? '#949eb2' : '#5a6580', accent = dark ? '#f08a59' : '#bf4520';
  const rule = dark ? '#63697d' : '#bfc0c0', node = dark ? '#323749' : '#ffffff';
  const font = "'Geist', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  return {
    ...theme,
    variables: {
      ...theme.variables,
      '--ccv-bg': paper, '--ccv-canvas': paper, '--ccv-soft': surface, '--ccv-text': ink,
      '--ccv-muted': muted, '--ccv-border': rule, '--ccv-accent': accent, '--ccv-font': font,
      '--ccv-radius': '8px', '--ccv-dot': 'transparent',
      '--ccv-frontend': muted, '--ccv-backend': ink, '--ccv-database': muted, '--ccv-security': accent,
      '--ccv-messagebus': muted, '--ccv-cloud': muted, '--ccv-external': soft,
      '--ccv-design-node': node, '--ccv-design-soft': soft,
    },
    mermaid: {
      theme: 'base', look: 'classic',
      themeVariables: {
        darkMode: dark, fontFamily: font, fontSize: '15px', background: paper,
        primaryColor: node, primaryTextColor: ink, primaryBorderColor: muted,
        secondaryColor: surface, secondaryTextColor: ink, secondaryBorderColor: muted,
        tertiaryColor: paper, tertiaryTextColor: ink, tertiaryBorderColor: rule,
        lineColor: muted, textColor: ink, mainBkg: node, nodeBorder: muted,
        clusterBkg: paper, clusterBorder: rule, edgeLabelBackground: paper,
        actorBkg: node, actorBorder: muted, actorTextColor: ink, actorLineColor: rule,
        signalColor: muted, signalTextColor: ink, labelBoxBkgColor: surface, labelBoxBorderColor: rule,
        labelTextColor: muted, loopTextColor: muted, activationBkgColor: surface, activationBorderColor: muted,
        noteBkgColor: surface, noteBorderColor: rule, noteTextColor: ink,
        sequenceNumberColor: paper, attributeBackgroundColorOdd: paper, attributeBackgroundColorEven: surface,
      },
    },
  };
}
