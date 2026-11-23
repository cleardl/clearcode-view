import { diagramDesignTheme } from './diagram-design-theme.js';
import { presentDiagramDesign } from './diagram-design-presentation.js';
import { nativeRenderer } from './native.js';

/** Diagram Design-inspired presentation; native Mermaid keeps every construct and handles automatic layout. */
export const diagramDesignRenderer = nativeRenderer({
  id: 'diagram-design', label: 'Diagram Design · 简洁', resolveTheme: diagramDesignTheme,
  present: presentDiagramDesign,
});
