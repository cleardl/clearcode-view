import type { FlowDB } from 'mermaid/dist/diagrams/flowchart/flowDb.js';
import type { GraphMetadata, GraphGroup } from '../model.js';
import type { ElementRef } from '../../core/model.js';

function displayLabel(text: string): string { return text.replace(/<br\s*\/?\s*>/gi, ' · '); }

/** Read flowchart semantics from the pinned engine, rather than reparsing arrows. */
export function flowchartMetadata(db: FlowDB): GraphMetadata {
  const groups: GraphGroup[] = db.getSubGraphs().map(group => ({
    id: group.id, label: displayLabel(group.title), nodes: [...group.nodes], collapsed: group.metadata?.view === 'collapsed',
  }));
  const groupIds = new Set(groups.map(group => group.id));
  const parents = (id: string): string[] => {
    const result: string[] = [];
    let current = id;
    while (true) {
      const owner = groups.find(group => group.nodes.includes(current) && group.id !== current);
      if (!owner || result.includes(owner.id)) break;
      result.push(owner.id); current = owner.id;
    }
    return result;
  };
  const elements: GraphMetadata['elements'] = new Map();
  for (const [id, node] of db.getVertices()) if (!groupIds.has(id)) {
    const ref: ElementRef = `node:${id}`;
    elements.set(ref, { ref, label: displayLabel(node.text || id), dataId: id, parents: parents(id), classes: [...node.classes], shape: node.type });
  }
  for (const group of groups) {
    const ref: ElementRef = `group:${group.id}`;
    elements.set(ref, { ref, label: group.label, dataId: group.id, parents: parents(group.id), classes: [...(db.getSubGraphs().find(value => value.id === group.id)?.classes || [])] });
  }
  for (const edge of db.getEdges()) if (edge.id && edge.isUserDefinedId) {
    const ref: ElementRef = `edge:${edge.id}`;
    const from = elements.get(`node:${edge.start}`)?.label || elements.get(`group:${edge.start}`)?.label || edge.start;
    const to = elements.get(`node:${edge.end}`)?.label || elements.get(`group:${edge.end}`)?.label || edge.end;
    elements.set(ref, { ref, label: edge.text || `${from} → ${to}`, dataId: edge.id, parents: [], from: edge.start, to: edge.end, classes: [...edge.classes] });
  }
  return { type: 'flowchart', elements, groups };
}

/** View overrides are native Mermaid metadata appended to the original graph. */
export function flowchartView(source: string, groups: GraphGroup[], collapsed?: Record<string, boolean>): string {
  if (!collapsed) return source;
  return source + '\n' + groups.map(group => `${group.id}@{ view: ${collapsed[group.id] ?? group.collapsed ? 'collapsed' : 'expanded'} }`).join('\n');
}
