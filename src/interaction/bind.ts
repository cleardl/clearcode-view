import { DocumentError, type ElementRef, type SourceLocation } from '../core/model.js';
import type { DiagramGraph, GraphGroup } from '../core/graph.js';
import type { BoundElements } from '../renderers/model.js';

/** Associate a graphical target or passive label with the common interaction attributes. */
export function markSceneElement(element: SVGElement, ref: ElementRef, label: string, bound: BoundElements, interactive = true): void {
  element.setAttribute('data-ccv-ref', ref);
  element.classList.add('ccv-element');
  if (interactive) { element.setAttribute('tabindex', '0'); element.setAttribute('role', 'button'); element.setAttribute('aria-label', label); element.classList.add('panzoom-exclude'); }
  const items = bound.get(ref) || [];
  if (!items.includes(element)) { items.push(element); bound.set(ref, items); }
}

/** Explicit fold controls are shared across backends; selection never expands a group. */
export function appendGroupControls(bound: BoundElements, groups: GraphGroup[], collapsed: Record<string, boolean>): void {
  for (const group of groups) {
    const parent = bound.get(`group:${group.id}`)?.[0];
    if (!parent || !(parent instanceof SVGGraphicsElement)) continue;
    const frame = parent.querySelector<SVGGraphicsElement>(':scope > rect');
    const box = (frame || parent).getBBox();
    const button = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    button.setAttribute('transform', `translate(${box.x + box.width - 24},${box.y + 6})`);
    button.setAttribute('data-ccv-toggle', group.id);
    button.setAttribute('role', 'button'); button.setAttribute('tabindex', '0');
    button.setAttribute('aria-label', `${collapsed[group.id] ? '展开' : '收起'} ${group.label}`);
    button.classList.add('ccv-fold-button', 'panzoom-exclude');
    const rectangle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rectangle.setAttribute('width', '18'); rectangle.setAttribute('height', '18'); rectangle.setAttribute('rx', '4');
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    icon.setAttribute('d', collapsed[group.id] ? 'M5 9H13M9 5V13' : 'M5 9H13');
    icon.setAttribute('aria-hidden', 'true');
    button.append(rectangle, icon); parent.append(button);
  }
}

/** Backends using standard semantic attributes can reuse binding and fold controls. */
export function bindSemanticElements(svg: SVGSVGElement, graph: DiagramGraph, collapsed: Record<string, boolean>, location: SourceLocation): BoundElements {
  const bound: BoundElements = new Map();
  const elements = new Map<string, import('../core/graph.js').GraphElement>(graph.elements);
  for (const element of svg.querySelectorAll<SVGElement>('[data-ccv-ref]')) {
    const ref = element.getAttribute('data-ccv-ref')!;
    const item = elements.get(ref);
    if (!item) throw new DocumentError(location, `渲染结果包含未知图元素：${ref}`);
    markSceneElement(element, item.ref, item.label, bound, element.getAttribute('data-ccv-passive') !== 'true');
  }
  appendGroupControls(bound, graph.groups, collapsed);
  return bound;
}
