import type { BoundElements, LegendEntry } from './model.js';
import type { GraphElement, GraphMetadata } from '../mermaid/model.js';
import { semanticRoles, type SemanticRole } from '../themes/model.js';

const labels: Record<SemanticRole, string> = { frontend: '客户端', backend: '服务 / 执行', database: '存储', security: '策略 / 安全', messagebus: '消息 / 异步', cloud: '基础设施', external: '外部对象' };

function validRole(value: string | undefined): SemanticRole | undefined {
  return semanticRoles.find(role => role === value);
}

/** Native classes or properties take priority over neutral participant colors. */
export function elementRole(item: GraphElement, index = 0): SemanticRole | undefined {
  return validRole(item.role) || item.classes?.filter(value => value.startsWith('ccv-')).map(value => validRole(value.slice(4))).find(Boolean)
    || (item.ref.startsWith('participant:') ? item.shape === 'database' ? 'database' : item.shape === 'queue' ? 'messagebus' : item.shape === 'actor' ? 'external' : semanticRoles[index % semanticRoles.length] : undefined);
}

function tone(element: SVGElement, role: SemanticRole): void {
  element.setAttribute('data-ccv-role', role);
  element.style.setProperty('--ccv-element-color', `var(--ccv-${role})`);
}

function markerColors(svg: SVGSVGElement): void {
  const defs = svg.querySelector('defs');
  if (!defs) return;
  const originals = new Map([...svg.querySelectorAll('marker')].map(marker => [marker.id, marker]));
  let index = 0;
  for (const line of svg.querySelectorAll<SVGElement>('path.flowchart-link, [data-et="message"]')) {
    const color = line.style.getPropertyValue('--ccv-element-color');
    if (!color) continue;
    for (const attribute of ['marker-start', 'marker-end']) {
      const originalId = line.getAttribute(attribute)?.match(/#([^\s)"']+)/)?.[1];
      const original = originalId && originals.get(originalId);
      if (!original) continue;
      const marker = original.cloneNode(true) as SVGMarkerElement;
      marker.id = `${svg.id}-ccv-arrow-${index++}`;
      marker.style.setProperty('--ccv-arrow-color', color);
      const shapes = [...original.querySelectorAll<SVGElement>('path, polygon, polyline, circle')];
      for (const [index, shape] of [...marker.querySelectorAll<SVGElement>('path, polygon, polyline, circle')].entries()) {
        shape.style.setProperty('stroke', 'var(--ccv-arrow-color)', 'important');
        const source = shapes[index], open = source.getAttribute('fill') === 'none' || source.style.fill === 'none' || getComputedStyle(source).fill === 'none';
        shape.style.setProperty('fill', open ? 'none' : 'var(--ccv-arrow-color)', 'important');
      }
      defs.append(marker);
      line.setAttribute(attribute, `url(#${marker.id})`);
    }
  }
}

/** Decorate native SVG after binding; the protocol and graph topology stay unchanged. */
export function presentDiagram(svg: SVGSVGElement, metadata: GraphMetadata, bound: BoundElements): LegendEntry[] {
  if (metadata.type === 'other') return [];
  const legend: LegendEntry[] = [];
  const participants = [...metadata.elements.values()].filter(item => item.ref.startsWith('participant:'));
  const actors = new Map(participants.map((item, index) => [item.dataId, elementRole(item, index)!]));
  for (const [index, item] of [...metadata.elements.values()].entries()) {
    const receiver = metadata.type === 'block' && item.to ? metadata.elements.get(`node:${item.to}`) : undefined;
    const role = item.ref.startsWith('participant:') ? actors.get(item.dataId) : elementRole(item, index) || (receiver ? elementRole(receiver) : undefined);
    if (!role) continue;
    for (const element of bound.get(item.ref) || []) tone(element, role);
    const id = metadata.type === 'sequence' ? item.ref : role;
    if (!legend.some(entry => entry.id === id)) legend.push({ id, label: metadata.type === 'sequence' ? item.label : labels[role], role });
  }
  for (const element of svg.querySelectorAll<SVGElement>('[data-et="life-line"], .actor-bottom')) {
    const role = actors.get(element.getAttribute('data-id') || element.getAttribute('name') || '');
    if (role) tone(element, role);
  }
  for (const line of svg.querySelectorAll<SVGElement>('[data-et="message"]')) {
    const role = actors.get(line.getAttribute('data-from') || '');
    if (!role) continue;
    tone(line, role);
    let text = line.previousElementSibling;
    while (text instanceof SVGElement && text.classList.contains('messageText')) { tone(text, role); text = text.previousElementSibling; }
  }
  for (const element of svg.querySelectorAll<SVGElement>('.activation0, .activation1, .activation2')) {
    const x = Number(element.getAttribute('x')) + Number(element.getAttribute('width')) / 2;
    const lifeline = [...svg.querySelectorAll<SVGElement>('[data-et="life-line"]')].find(line => Math.abs(Number(line.getAttribute('x1')) - x) < 1);
    const role = lifeline?.getAttribute('data-ccv-role');
    if (role && validRole(role)) tone(element, validRole(role)!);
  }
  for (const line of svg.querySelectorAll<SVGElement>('path.flowchart-link')) {
    if (!line.hasAttribute('data-ccv-role')) line.style.setProperty('--ccv-element-color', getComputedStyle(line).stroke);
  }
  if (metadata.type === 'sequence') {
    if (svg.querySelector('.messageLine0')) legend.push({ id: 'solid', label: '实线消息', line: 'solid' });
    if (svg.querySelector('.messageLine1')) legend.push({ id: 'dashed', label: '虚线消息', line: 'dashed' });
  }
  markerColors(svg);
  for (const element of svg.querySelectorAll<SVGElement>('.ccv-layer')) {
    const rectangle = element.querySelector(':scope > rect.composite');
    const heading = element.querySelector(':scope > .label');
    if (rectangle && heading) heading.setAttribute('transform', `translate(${Number(rectangle.getAttribute('x')) + 16}, ${Number(rectangle.getAttribute('y')) + 5})`);
  }
  return legend;
}
