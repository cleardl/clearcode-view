import type { DiagramKind, ElementRef, MermaidSource } from './model.js';

/** Semantic identity contains no renderer DOM IDs or layout coordinates. */
export interface GraphElement {
  ref: ElementRef;
  label: string;
  parents: string[];
  from?: string;
  to?: string;
  classes?: string[];
  role?: string;
  shape?: string;
}

/** Group membership and authored initial collapse state. */
export interface GraphGroup { id: string; label: string; nodes: string[]; collapsed: boolean }

/** Interaction semantics, independent of Markdown and renderer element names. */
export interface DiagramGraph { type: DiagramKind; elements: Map<ElementRef, GraphElement>; groups: GraphGroup[] }

/** Source remains intact for constructs outside the current semantic index. */
export interface ParsedDiagram { input: MermaidSource; nativeType: string; graph: DiagramGraph }

/** Resolve hidden members to visible collapsed containers without expanding them. */
export function visibleReference(ref: ElementRef, graph: DiagramGraph, collapsed: Record<string, boolean>): ElementRef {
  const item = graph.elements.get(ref);
  if (!item) return ref;
  const ancestors = item.parents.filter(id => collapsed[id]);
  if (ancestors.length) return `group:${ancestors[ancestors.length - 1]}`;
  if (item.from && item.to) {
    const from = visibleReference(`node:${item.from}`, graph, collapsed);
    const to = visibleReference(`node:${item.to}`, graph, collapsed);
    if (from === to && from.startsWith('group:')) return from;
  }
  return ref;
}
