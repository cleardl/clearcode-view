import { presentDiagram } from './custom-presentation.js';
import { nativeRenderer } from './native.js';

/** The existing interactive Mermaid implementation, isolated behind the renderer interface. */
export const customRenderer = nativeRenderer({
  id: 'custom', label: '定制版',
  present: presentDiagram,
});
