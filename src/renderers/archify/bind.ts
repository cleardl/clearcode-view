import type { ParsedDiagram } from '../../core/graph.js';
import type { ElementRef } from '../../core/model.js';
import { markSceneElement, appendGroupControls } from '../../interaction/bind.js';
import { participantHitAreas } from '../../interaction/hit-area.js';
import type { BoundElements } from '../model.js';
import type { ArchifyProjection } from './model.js';

function collections(projection: ArchifyProjection, name: string): { id: string }[] { return projection.document[name] as { id: string }[] || []; }
function group(element: SVGElement): SVGGElement {
  if (element instanceof SVGGElement) return element;
  const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  element.before(wrapper); wrapper.append(element); return wrapper;
}

/** Namespace all local SVG references so multiple drawings can safely share one document. */
export function scopeArchifySvg(svg: SVGSVGElement, id: string): void {
  const ids = new Map<string, string>();
  for (const element of svg.querySelectorAll('[id]')) { const value = `${id}-${element.id}`; ids.set(element.id, value); element.id = value; }
  svg.id = id;
  for (const element of [svg, ...svg.querySelectorAll('*')]) for (const attribute of [...element.attributes]) {
    if (attribute.name === 'id') continue;
    let value = attribute.value.replace(/url\(#([^)]*)\)/g, (_, reference: string) => `url(#${ids.get(reference) || reference})`);
    if (attribute.name === 'aria-labelledby' || attribute.name === 'aria-describedby') value = value.split(' ').map(reference => ids.get(reference) || reference).join(' ');
    if (attribute.name === 'href' && value.startsWith('#')) value = '#' + (ids.get(value.slice(1)) || value.slice(1));
    if (value !== attribute.value) element.setAttribute(attribute.name, value);
  }
}

function mirroredActors(svg: SVGSVGElement): void {
  const actors = [...svg.querySelectorAll<SVGGElement>('[data-node-id]')];
  if (!actors.length) return;
  const box = svg.viewBox.baseVal, bounds = actors.map(actor => actor.getBBox());
  const top = Math.min(...bounds.map(bounds => bounds.y));
  const height = Math.max(...bounds.map(bounds => bounds.y + bounds.height)) - top;
  const lines = [...svg.querySelectorAll<SVGPathElement>('[data-archify-lifeline]')];
  const lifelineBottom = Math.max(...lines.map(line => Number(line.getAttribute('data-lifeline-end'))));
  const footerTop = lifelineBottom + 24, extra = height + 60;
  const footer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  footer.setAttribute('data-archify-mirrored', ''); footer.setAttribute('transform', `translate(0,${footerTop - top})`);
  for (const actor of actors) {
    const copy = actor.cloneNode(true) as SVGGElement;
    for (const item of [copy, ...copy.querySelectorAll<SVGElement>('[id]')]) if (item.id) item.id += '-footer';
    footer.append(copy);
  }
  for (const line of lines) line.setAttribute('d', line.getAttribute('d')!.replace(/(L\s+[-\d.]+\s+)[-\d.]+$/, '$1' + footerTop));
  // Legends are top-level groups carrying their own semantic legend hooks.
  for (const legend of svg.querySelectorAll<SVGElement>('[data-legend]')) legend.setAttribute('transform', `translate(0,${extra}) ${legend.getAttribute('transform') || ''}`);
  box.height += extra; svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`); svg.setAttribute('height', String(box.height));
  svg.append(footer);
}

/** Reuse the common sidebar, focus and explicit fold controls instead of the upstream viewer. */
export function bindArchify(svg: SVGSVGElement, projection: ArchifyProjection, diagram: ParsedDiagram, collapsed: Record<string, boolean>): BoundElements {
  const bound: BoundElements = new Map();
  if (projection.document.diagram_type === 'sequence') mirroredActors(svg);
  const mark = (element: SVGElement, ref?: ElementRef, interactive = true) => {
    const item = ref && diagram.graph.elements.get(ref);
    if (ref && item) markSceneElement(element, ref, item.label, bound, interactive);
  };
  for (const element of svg.querySelectorAll<SVGElement>('[data-node-id]')) {
    const ref = projection.nodeRefs.get(element.getAttribute('data-node-id')!);
    if (ref) mark(element, ref);
    else { element.removeAttribute('tabindex'); element.removeAttribute('role'); element.removeAttribute('aria-pressed'); }
  }
  for (const element of svg.querySelectorAll<SVGElement>('[data-edge-id]')) mark(element, projection.edgeRefs.get(element.getAttribute('data-edge-id')!));
  // Official trees derive connectors from parent membership without relationship IDs.
  for (const element of svg.querySelectorAll<SVGElement>('[data-edge-from][data-edge-to]:not([data-edge-id])')) {
    const from = element.getAttribute('data-edge-from'), to = element.getAttribute('data-edge-to');
    const matches = [...diagram.graph.elements.values()].filter(item => item.from === from && item.to === to);
    if (matches.length === 1) mark(element, matches[0].ref);
  }
  const type = projection.document.diagram_type;
  for (const frame of svg.querySelectorAll<SVGElement>('[data-composition-frame-id]')) {
    const index = frame.getAttribute('data-composition-frame-id')!, kind = frame.getAttribute('data-composition-frame-kind');
    const collection = type === 'architecture' ? 'boundaries' : type === 'dataflow' ? 'stages' : kind === 'lane' ? 'lanes' : kind === 'group' ? 'groups' : '';
    if (!collection) continue;
    const item = collections(projection, collection)[Number(index.replace(/^(?:lane|group)-/, ''))];
    if (item) mark(group(frame), projection.groupRefs.get(item.id));
  }
  for (const element of svg.querySelectorAll<SVGElement>('[data-archify-phase]')) mark(element, projection.phaseRefs.get(element.getAttribute('data-archify-phase')!));
  if (projection.phaseContainer) {
    const elements = [...svg.querySelectorAll<SVGGraphicsElement>('[data-archify-phase]')];
    if (elements.length) {
      const boxes = elements.map(element => element.getBBox()), x = Math.min(...boxes.map(box => box.x)), y = Math.min(...boxes.map(box => box.y));
      const width = Math.max(...boxes.map(box => box.x + box.width)) - x, height = Math.max(...boxes.map(box => box.y + box.height)) - y;
      const target = document.createElementNS('http://www.w3.org/2000/svg', 'g'), rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      for (const [name, value] of Object.entries({ x, y, width, height })) rect.setAttribute(name, String(value));
      rect.setAttribute('fill', 'transparent'); target.append(rect); svg.prepend(target); mark(target, projection.phaseContainer);
    }
  }
  // Upstream viewer scripts are not loaded; branch controls must not imply unavailable behavior.
  for (const element of svg.querySelectorAll('[data-tree-toggle], [data-tree-expand-all]')) element.remove();
  participantHitAreas(bound);
  appendGroupControls(bound, diagram.graph.groups, collapsed);
  return bound;
}
