import type { DiagramKind, ElementRef } from '../core/model.js';
import type { GraphElement as SemanticElement, GraphGroup } from '../core/graph.js';

export { visibleReference } from '../core/graph.js';
export type { GraphGroup } from '../core/graph.js';

/** Only the native adapter knows Mermaid's SVG and parser identities. */
export interface GraphElement extends SemanticElement { dataId: string; domId?: string }

/** Renderer-local identities stay out of the shared semantic graph. */
export interface GraphMetadata { type: DiagramKind; elements: Map<ElementRef, GraphElement>; groups: GraphGroup[] }
