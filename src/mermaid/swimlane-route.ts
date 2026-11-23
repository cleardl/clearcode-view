import { Graph } from 'dagre-d3-es/src/graphlib/graph.js';
import { dijkstra } from 'dagre-d3-es/src/graphlib/alg/dijkstra.js';

/** Geometry in native SVG units, independent of labels, Markdown and themes. */
export interface RouteBox { x: number; y: number; width: number; height: number }
export type RoutePoint = [number, number];
type Side = 'top' | 'bottom' | 'left' | 'right';
type Axis = 'h' | 'v';
const clearance = 14, stub = 26;

function inside([x, y]: RoutePoint, box: RouteBox): boolean {
  return x > box.x && x < box.x + box.width && y > box.y && y < box.y + box.height;
}

/** An orthogonal segment crosses a rectangle's interior; touching its outline is permitted. */
export function crossesBox(a: RoutePoint, b: RoutePoint, box: RouteBox): boolean {
  if (a[0] === b[0]) return a[0] > box.x && a[0] < box.x + box.width && Math.max(a[1], b[1]) > box.y && Math.min(a[1], b[1]) < box.y + box.height;
  if (a[1] === b[1]) return a[1] > box.y && a[1] < box.y + box.height && Math.max(a[0], b[0]) > box.x && Math.min(a[0], b[0]) < box.x + box.width;
  throw new Error('Swimlane routing requires orthogonal segments');
}

function expand(box: RouteBox): RouteBox {
  return { x: box.x - clearance, y: box.y - clearance, width: box.width + clearance * 2, height: box.height + clearance * 2 };
}

function port(box: RouteBox, side: Side, distance = stub): { point: RoutePoint; outside: RoutePoint; axis: Axis } {
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  if (side === 'top') return { point: [x, box.y], outside: [x, box.y - distance], axis: 'v' };
  if (side === 'bottom') return { point: [x, box.y + box.height], outside: [x, box.y + box.height + distance], axis: 'v' };
  if (side === 'left') return { point: [box.x, y], outside: [box.x - distance, y], axis: 'h' };
  return { point: [box.x + box.width, y], outside: [box.x + box.width + distance, y], axis: 'h' };
}

function compact(points: RoutePoint[]): RoutePoint[] {
  const result: RoutePoint[] = [];
  for (const point of points) {
    const last = result.at(-1), previous = result.at(-2);
    if (last && last[0] === point[0] && last[1] === point[1]) continue;
    if (last && previous && ((previous[0] === last[0] && last[0] === point[0]) || (previous[1] === last[1] && last[1] === point[1]))) result.pop();
    result.push(point);
  }
  return result;
}

function occupiedCost(a: RoutePoint, b: RoutePoint, occupied: RoutePoint[][]): number {
  let cost = 0;
  for (const points of occupied) for (let i = 1; i < points.length; i++) {
    const c = points[i - 1], d = points[i];
    if (a[0] === b[0] && c[0] === d[0] && Math.abs(a[0] - c[0]) < clearance) {
      cost += Math.max(0, Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1])) - Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1]))) * 8;
    } else if (a[1] === b[1] && c[1] === d[1] && Math.abs(a[1] - c[1]) < clearance) {
      cost += Math.max(0, Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) - Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0]))) * 8;
    }
  }
  return cost;
}

/** Route native block edges around node/text obstacles, preferring short paths with few turns. */
export function swimlaneRoute(from: RouteBox, to: RouteBox, obstacles: RouteBox[], occupied: RoutePoint[][] = []): RoutePoint[] {
  const sameRow = Math.abs(from.y + from.height / 2 - to.y - to.height / 2) < 1;
  const down = to.y > from.y;
  const sides: [Side, Side][] = sameRow
    ? [[to.x > from.x ? 'right' : 'left', to.x > from.x ? 'left' : 'right']]
    : down ? [['bottom', 'top'], ['bottom', 'left'], ['right', 'top'], ['right', 'right'], ['left', 'left'], ['right', 'left']]
      : [['left', 'left'], ['right', 'right']];
  const boxes = obstacles.map(expand);
  let best: { points: RoutePoint[]; cost: number } | undefined;
  for (const [index, [fromSide, toSide]] of sides.entries()) {
    const distance = sameRow ? Math.min(stub, Math.abs(to.x > from.x ? to.x - from.x - from.width : from.x - to.x - to.width) / 2) : stub;
    const start = port(from, fromSide, distance), end = port(to, toSide, distance);
    if (boxes.some(box => inside(start.outside, box) || inside(end.outside, box))) continue;
    const xs = new Set([start.outside[0], end.outside[0]]), ys = new Set([start.outside[1], end.outside[1]]);
    for (const box of boxes) { xs.add(box.x); xs.add(box.x + box.width); ys.add(box.y); ys.add(box.y + box.height); }
    for (const path of occupied) for (const [x, y] of path) { xs.add(x - clearance); xs.add(x + clearance); ys.add(y - clearance); ys.add(y + clearance); }
    const xValues = [...xs].sort((a, b) => a - b), yValues = [...ys].sort((a, b) => a - b);
    if (xValues.length * yValues.length > 16000) throw new Error('泳道图的路由网格过大，请按职责拆分图表');
    const grid = new Graph({ directed: true }), coordinates = new Map<string, RoutePoint>();
    const key = (x: number, y: number, axis: Axis) => `${x},${y},${axis}`;
    for (const x of xValues) for (const y of yValues) if (!boxes.some(box => inside([x, y], box))) {
      for (const axis of ['h', 'v'] as const) { const id = key(x, y, axis); grid.setNode(id); coordinates.set(id, [x, y]); }
      grid.setEdge(key(x, y, 'h'), key(x, y, 'v'), 44); grid.setEdge(key(x, y, 'v'), key(x, y, 'h'), 44);
    }
    const connect = (a: RoutePoint, b: RoutePoint, axis: Axis) => {
      const aId = key(...a, axis), bId = key(...b, axis);
      if (!grid.hasNode(aId) || !grid.hasNode(bId) || boxes.some(box => crossesBox(a, b, box))) return;
      const distance = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + occupiedCost(a, b, occupied);
      grid.setEdge(aId, bId, distance); grid.setEdge(bId, aId, distance);
    };
    for (const y of yValues) for (let i = 1; i < xValues.length; i++) connect([xValues[i - 1], y], [xValues[i], y], 'h');
    for (const x of xValues) for (let i = 1; i < yValues.length; i++) connect([x, yValues[i - 1]], [x, yValues[i]], 'v');
    const startId = key(...start.outside, start.axis), endId = key(...end.outside, end.axis);
    const paths = dijkstra(grid, startId, edge => Number(grid.edge(edge))), cost = paths[endId]?.distance + index * 24;
    if (!Number.isFinite(cost) || (best && cost >= best.cost)) continue;
    const points: RoutePoint[] = [end.point];
    for (let id: string | undefined = endId; id; id = paths[id]?.predecessor) points.push(coordinates.get(id)!);
    points.push(start.point);
    best = { points: compact(points.reverse()), cost };
  }
  if (!best) throw new Error('泳道连线无法避开节点和文字，请为相关分支预留列或拆分图表');
  return best.points;
}

/** Round orthogonal bends while preserving endpoints and native marker/dash attributes. */
export function roundedRoute(points: RoutePoint[]): string {
  let path = `M${points[0].join(',')}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const radius = Math.min(8, (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])) / 2, (Math.abs(b[0] - c[0]) + Math.abs(b[1] - c[1])) / 2);
    const before = [b[0] + Math.sign(a[0] - b[0]) * radius, b[1] + Math.sign(a[1] - b[1]) * radius];
    const after = [b[0] + Math.sign(c[0] - b[0]) * radius, b[1] + Math.sign(c[1] - b[1]) * radius];
    path += `L${before.join(',')}Q${b.join(',')} ${after.join(',')}`;
  }
  return path + `L${points.at(-1)!.join(',')}`;
}
