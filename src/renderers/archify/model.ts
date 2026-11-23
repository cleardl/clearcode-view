import type { ElementRef } from '../../core/model.js';

export const archifyKinds = ['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle', 'erd', 'class', 'tree', 'timeline', 'waterfall'] as const;
export type ArchifyKind = typeof archifyKinds[number];
/** A renderer-internal projection of native Mermaid semantics, never an authored second graph. */
export interface ArchifyNode {
  id: string;
  label: string;
  type?: string;
  sublabel?: string;
  tag?: string;
  parent?: string;
  pos?: number[];
  size?: number[];
  [property: string]: unknown;
}
export interface ArchifyRelation {
  id: string;
  from: string;
  to: string;
  label?: string;
  variant?: string;
  [property: string]: unknown;
}
export interface ArchifyDocument {
  schema_version: number;
  diagram_type: ArchifyKind;
  meta: { title: string; output: string; [property: string]: unknown };
  [collection: string]: unknown;
}
/** Stable reading references are associated with native upstream semantic hooks. */
export interface ArchifyProjection {
  document: ArchifyDocument;
  nodeRefs: Map<string, ElementRef>;
  edgeRefs: Map<string, ElementRef>;
  groupRefs: Map<string, ElementRef>;
  phaseRefs: Map<string, ElementRef>;
  phaseContainer?: ElementRef;
}
export interface ArchifyOutput { svg: string; report?: unknown }
