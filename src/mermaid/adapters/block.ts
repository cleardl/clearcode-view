import type { BlockDB } from 'mermaid/dist/diagrams/block/blockDB.js';
import type { Block } from 'mermaid/dist/diagrams/block/blockTypes.js';
import type { GraphMetadata } from '../model.js';
import type { ElementRef } from '../../core/model.js';

function label(block: Block): string {
  return (block.label || block.children.find(child => child.label)?.label || block.id).replace(/<br\s*\/?\s*>/gi, ' · ');
}

/** Read native block identities; composite blocks are selectable, fixed layout groups. */
export function blockMetadata(db: BlockDB, diagramId: string): GraphMetadata {
  const elements: GraphMetadata['elements'] = new Map();
  const invisible = new Set(['space', 'edge', 'column-setting', 'classDef', 'applyClass', 'applyStyles']);
  const ancestry = new Map<string, string[]>();
  function visit(blocks: Block[], parents: string[]): void {
    for (const block of blocks) {
      if (invisible.has(block.type || '')) continue;
      ancestry.set(block.id, parents);
      if (block.type === 'composite') visit(block.children, [block.id, ...parents]);
    }
  }
  visit(db.getBlocks(), []);
  for (const block of db.getBlocksFlat()) {
    if (block.id === 'root' || invisible.has(block.type || '')) continue;
    const ref: ElementRef = `${block.type === 'composite' ? 'group' : 'node'}:${block.id}`;
    elements.set(ref, { ref, dataId: block.id, domId: `${diagramId}-${block.id}`, label: label(block), parents: ancestry.get(block.id) || [], classes: [...(block.classes || [])], shape: block.type });
  }
  for (const edge of db.getEdges()) {
    const ref: ElementRef = `edge:${edge.id}`;
    const from = elements.get(`node:${edge.start}`)?.label || edge.start;
    const to = elements.get(`node:${edge.end}`)?.label || edge.end;
    // Mermaid 12.3 prefixes block edges in both blockRenderer and insertEdge.
    elements.set(ref, { ref, dataId: edge.id, domId: `${diagramId}-${diagramId}-${edge.id}`, label: edge.label || `${from} → ${to}`, parents: [], from: edge.start, to: edge.end, classes: [...(edge.classes || [])] });
  }
  return { type: 'block', elements, groups: [] };
}
