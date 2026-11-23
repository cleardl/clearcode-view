import type { BoundElements } from '../renderers/model.js';

/** Treat an object's icon and label as one target without drawing another visible box or focus stop. */
export function participantHitAreas(bindings: BoundElements): void {
  for (const [ref, elements] of bindings) {
    if (!ref.startsWith('participant:')) continue;
    for (const element of elements) {
      if (!(element instanceof SVGGraphicsElement) || element.tagName !== 'g') continue;
      const box = element.getBBox(), target = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      target.setAttribute('data-ccv-hit', '');
      for (const [name, value] of Object.entries({ x: box.x, y: box.y, width: box.width, height: box.height })) target.setAttribute(name, String(value));
      target.style.setProperty('fill', 'transparent', 'important');
      target.style.setProperty('stroke', 'none', 'important');
      target.style.setProperty('pointer-events', 'all');
      element.insertBefore(target, element.firstChild);
    }
  }
}
