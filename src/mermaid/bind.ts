import type { ElementRef } from '../core/model.js';
import type { GraphMetadata } from './model.js';
import { annotateSequenceFooters } from './adapters/sequence.js';
import { markSceneElement as mark, appendGroupControls } from '../interaction/bind.js';
import type { BoundElements } from '../renderers/model.js';
export type { BoundElements } from '../renderers/model.js';

/** The fold control replaces Mermaid's decorative dots; its header must not share the label area. */
function placeCollapsedLabels(bound: BoundElements, metadata: GraphMetadata, collapsed: Record<string, boolean>): void {
  if (metadata.type !== 'flowchart') return;
  for (const group of metadata.groups) {
    const parent = bound.get(`group:${group.id}`)?.[0];
    if (!parent || !collapsed[group.id]) continue;
    const frame = parent.querySelector<SVGRectElement>(':scope > rect.collapsed-group');
    const label = parent.querySelector<SVGGElement>(':scope > .label');
    if (!frame || !label) throw new Error(`无法定位原生折叠分组 ${group.id} 的外框或标题`);
    const box = frame.getBBox(), text = label.getBBox();
    const x = box.x + (box.width - text.width) / 2 - text.x;
    const y = box.y + 26 + (box.height - 34 - text.height) / 2 - text.y;
    label.setAttribute('transform', `translate(${x},${y})`);
    for (const decoration of parent.querySelectorAll('.collapsed-separator, .collapsed-indicator')) decoration.remove();
  }
}

/** Attach semantic attributes and explicit fold buttons to native engine output. */
export function bindDiagram(svg: SVGSVGElement, metadata: GraphMetadata, collapsed: Record<string, boolean>): BoundElements {
  if (metadata.type === 'sequence') annotateSequenceFooters(svg, metadata);
  const bound: BoundElements = new Map();
  const byId = new Map([...svg.querySelectorAll<SVGElement>('[id]')].map(element => [element.id, element]));
  for (const item of metadata.elements.values()) if (item.domId) {
    const element = byId.get(item.domId);
    if (element) mark(element, item.ref, item.label, bound);
  }
  for (const element of svg.querySelectorAll<SVGElement>('[data-id]')) {
    const id = element.getAttribute('data-id');
    let ref: ElementRef | undefined;
    if (metadata.type === 'flowchart') {
      if (element.matches('g.node, g.cluster')) ref = metadata.elements.has(`group:${id}`) ? `group:${id}` : `node:${id}`;
      else if (element.matches('path.flowchart-link, .edgeLabel [data-id]')) ref = `edge:${id}`;
    } else if (metadata.type === 'sequence') {
      if (element.getAttribute('data-et') === 'participant') ref = `participant:${id}`;
      else if (element.getAttribute('data-et') === 'message') ref = [...metadata.elements.values()].find(item => item.ref.startsWith('message:') && item.dataId === id)?.ref;
    } else if (metadata.type === 'block' && element.matches('.edgeLabel [data-id]')) {
      ref = `edge:${id}`;
    }
    const item = ref && metadata.elements.get(ref);
    if (!ref || !item) continue;
    mark(element, ref, item.label, bound);
    if (ref.startsWith('message:')) {
      let sibling = element.previousElementSibling;
      while (sibling instanceof SVGElement && sibling.classList.contains('messageText')) {
        mark(sibling, ref, item.label, bound, false); sibling = sibling.previousElementSibling;
      }
    }
  }
  placeCollapsedLabels(bound, metadata, collapsed);
  appendGroupControls(bound, metadata.groups, collapsed);
  return bound;
}
