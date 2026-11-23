/** Coordinates use the native edge layer's SVG units. */
export interface Point { x: number; y: number }
/** Axis-aligned node or label bounds in the same coordinate system as an edge. */
export interface Rect extends Point { width: number; height: number }

const epsilon = 0.01;
const portMargin = 12;
const clearance = 8;
const near = (a: number, b: number) => Math.abs(a - b) < epsilon;

function bounds(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x - clearance < b.x + b.width && a.x + a.width + clearance > b.x
    && a.y - clearance < b.y + b.height && a.y + a.height + clearance > b.y;
}

function compact(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const last = result.at(-1), before = result.at(-2);
    if (last && near(last.x, point.x) && near(last.y, point.y)) continue;
    if (last && before && ((near(before.x, last.x) && near(last.x, point.x) && (last.y - before.y) * (point.y - last.y) > 0)
      || (near(before.y, last.y) && near(last.y, point.y) && (last.x - before.x) * (point.x - last.x) > 0))) result.pop();
    result.push(point);
  }
  return result;
}

function atEnd(points: Point[], rectangles: Rect[], obstacles: Rect[], others: Point[][]): Point[] | undefined {
  if (points.length < 4) return;
  const [a, b, c, d] = points.slice(-4);
  const vertical = near(a.x, b.x) && near(b.y, c.y) && near(c.x, d.x);
  const horizontal = near(a.y, b.y) && near(b.x, c.x) && near(c.y, d.y);
  if (!vertical && !horizontal) return;
  const offset = vertical ? Math.abs(c.x - b.x) : Math.abs(c.y - b.y);
  const approach = vertical ? Math.abs(d.y - c.y) : Math.abs(d.x - c.x);
  const forward = vertical ? (b.y - a.y) * (d.y - c.y) > 0 : (b.x - a.x) * (d.x - c.x) > 0;
  if (!forward || offset > 48 || approach > 96) return;
  const end = vertical ? { x: a.x, y: d.y } : { x: d.x, y: a.y };
  const target = rectangles.find(rect => vertical
    ? near(d.y, d.y > c.y ? rect.y : rect.y + rect.height) && d.x >= rect.x && d.x <= rect.x + rect.width
      && end.x >= rect.x + portMargin && end.x <= rect.x + rect.width - portMargin
    : near(d.x, d.x > c.x ? rect.x : rect.x + rect.width) && d.y >= rect.y && d.y <= rect.y + rect.height
      && end.y >= rect.y + portMargin && end.y <= rect.y + rect.height - portMargin);
  if (!target) return;
  const changed = bounds(b, end);
  const removed = [bounds(b, c), bounds(c, d)];
  if (obstacles.some(rect => rect !== target && (overlaps(changed, rect) || removed.some(run => overlaps(run, rect))))) return;
  if (others.some(route => route.slice(1).some((point, index) => overlaps(changed, bounds(route[index], point))))) return;
  return [...points.slice(0, -3), end];
}

/** Align both rectangular ports only when their terminal steps can become one clear straight connection. */
export function directConnection(points: Point[], rectangles: Rect[], obstacles: Rect[], others: Point[][]): Point[] | undefined {
  const simple = compact(points);
  const fromEnd = compact(atEnd(simple, rectangles, obstacles, others) || simple);
  const fromStart = atEnd([...fromEnd].reverse(), rectangles, obstacles, others)?.reverse();
  const result = compact(fromStart || fromEnd);
  return result.length === 2 && simple.length > 2 ? result : undefined;
}

function inLayer(element: SVGGraphicsElement, layer: SVGGraphicsElement): Rect | undefined {
  const source = element.getCTM(), destination = layer.getCTM();
  if (!source || !destination) return;
  const matrix = destination.inverse().multiply(source);
  if (!near(matrix.b, 0) || !near(matrix.c, 0) || matrix.a <= 0 || matrix.d <= 0) return;
  const box = element.getBBox();
  if (!box.width || !box.height) return;
  return { x: box.x * matrix.a + matrix.e, y: box.y * matrix.d + matrix.f, width: box.width * matrix.a, height: box.height * matrix.d };
}

function nativePoints(path: SVGPathElement): Point[] | undefined {
  const encoded = path.getAttribute('data-points');
  if (!encoded) return;
  const value: unknown = JSON.parse(atob(encoded));
  if (!Array.isArray(value) || !value.every(point => point && typeof point === 'object' && 'x' in point && 'y' in point
    && typeof point.x === 'number' && typeof point.y === 'number' && Number.isFinite(point.x) && Number.isFinite(point.y))) return;
  return value as Point[];
}

/** Keep native layout and necessary turns; normalize only clear, solid rectangular-port connections. */
export function straightenFlowchart(svg: SVGSVGElement): void {
  if (svg.querySelector('.edge-step-badge, .edge-step-dot')) return;
  const paths = [...svg.querySelectorAll<SVGPathElement>('path.flowchart-link')];
  const layer = paths[0]?.parentElement;
  if (!(layer instanceof SVGGraphicsElement)) return;
  const rectangles: Rect[] = [], obstacles: Rect[] = [];
  for (const node of svg.querySelectorAll<SVGGElement>('g.node')) {
    const rect = node.querySelector<SVGRectElement>(':scope > rect.label-container');
    const box = inLayer(rect || node, layer);
    if (!box) continue;
    obstacles.push(box);
    if (rect) rectangles.push(box);
  }
  for (const label of svg.querySelectorAll<SVGGraphicsElement>('g.edgeLabel, .cluster-label')) {
    const box = inLayer(label, layer);
    if (box) obstacles.push(box);
  }
  const routes = new Map(paths.map(path => [path, nativePoints(path)]));
  if ([...routes.values()].some(points => !points)) return;
  for (const [path, points] of routes) {
    if (!points || path.parentElement !== layer || path.hasAttribute('transform') || !path.classList.contains('edge-pattern-solid')
      || [...path.classList].some(name => name.startsWith('edge-animation-'))
      || /[ACHS]/i.test(path.getAttribute('d') || '')) continue;
    const others = [...routes].filter(([other]) => other !== path).flatMap(([, route]) => route ? [route] : []);
    const direct = directConnection(points, rectangles, obstacles, others);
    if (!direct) continue;
    const start = path.getPointAtLength(0), end = path.getPointAtLength(path.getTotalLength());
    const vertical = near(direct[0].x, direct[1].x);
    const drawn = vertical ? [{ x: direct[0].x, y: start.y }, { x: direct[1].x, y: end.y }]
      : [{ x: start.x, y: direct[0].y }, { x: end.x, y: direct[1].y }];
    path.setAttribute('data-ccv-original-points', path.getAttribute('data-points')!);
    path.setAttribute('data-points', btoa(JSON.stringify(direct)));
    path.setAttribute('d', `M${drawn[0].x},${drawn[0].y}L${drawn[1].x},${drawn[1].y}`);
    const dash = path.style.getPropertyValue('stroke-dasharray').split(/[,\s]+/).map(Number);
    if (dash.length === 4 && dash[0] === 0 && dash.every(Number.isFinite)) {
      const length = Math.hypot(drawn[1].x - drawn[0].x, drawn[1].y - drawn[0].y);
      path.style.setProperty('stroke-dasharray', `0 ${dash[1]} ${Math.max(0, length - dash[1] - dash[3])} ${dash[3]}`);
    }
    routes.set(path, direct);
  }
}
