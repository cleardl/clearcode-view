import { markSceneElement } from '../interaction/bind.js';
import { participantHitAreas } from '../interaction/hit-area.js';
import type { GraphMetadata } from '../mermaid/model.js';
import type { BoundElements, LegendEntry } from './model.js';

/** Give each relationship its own selectable marker copy without changing filled/open arrow semantics. */
function bindMarkers(svg: SVGSVGElement, metadata: GraphMetadata, bindings: BoundElements): void {
  const defs = svg.querySelector('defs');
  if (!defs) return;
  const originals = new Map([...svg.querySelectorAll('marker')].map(marker => [marker.id, marker]));
  let index = 0;
  for (const item of metadata.elements.values()) {
    if (!item.ref.startsWith('edge:') && !item.ref.startsWith('message:')) continue;
    for (const line of [...(bindings.get(item.ref) || [])]) {
      for (const attribute of ['marker-start', 'marker-end']) {
        const id = line.getAttribute(attribute)?.match(/#([^\s)"']+)/)?.[1];
        const original = id && originals.get(id);
        if (!original) continue;
        const marker = original.cloneNode(true) as SVGMarkerElement;
        marker.id = `${svg.id}-design-arrow-${index++}`;
        const shapes = [...original.querySelectorAll<SVGElement>('path, polygon, polyline, circle')];
        for (const [position, shape] of [...marker.querySelectorAll<SVGElement>('path, polygon, polyline, circle')].entries()) {
          const open = shapes[position].getAttribute('fill') === 'none' || shapes[position].style.fill === 'none' || getComputedStyle(shapes[position]).fill === 'none';
          shape.setAttribute('data-ccv-design-arrow', open ? 'open' : 'filled');
          markSceneElement(shape, item.ref, item.label, bindings, false);
        }
        defs.append(marker);
        line.setAttribute(attribute, `url(#${marker.id})`);
      }
    }
  }
}

/** Neutral surfaces and one interactive accent; labels, native shapes and all relations remain intact. */
export function presentDiagramDesign(svg: SVGSVGElement, metadata: GraphMetadata, bindings: BoundElements): LegendEntry[] {
  bindMarkers(svg, metadata, bindings);
  participantHitAreas(bindings);
  for (const element of svg.querySelectorAll<SVGElement>('.ccv-layer')) {
    const rectangle = element.querySelector(':scope > rect.composite'), heading = element.querySelector(':scope > .label');
    if (rectangle && heading) heading.setAttribute('transform', `translate(${Number(rectangle.getAttribute('x')) + 16}, ${Number(rectangle.getAttribute('y')) + 5})`);
  }
  const legend: LegendEntry[] = [];
  const lines = metadata.type === 'sequence' ? svg.querySelectorAll('.messageLine0, .messageLine1') : svg.querySelectorAll('path.flowchart-link');
  const dashed = [...lines].some(line => line.matches('.messageLine1, .edge-pattern-dotted, .edge-pattern-dashed'));
  if ([...lines].some(line => !line.matches('.messageLine1, .edge-pattern-dotted, .edge-pattern-dashed'))) legend.push({ id: 'solid', label: metadata.type === 'sequence' ? '实线消息' : '实线关系', line: 'solid' });
  if (dashed) legend.push({ id: 'dashed', label: metadata.type === 'sequence' ? '虚线消息' : '虚线关系', line: 'dashed' });
  return legend;
}
