import type { BlockDB } from 'mermaid/dist/diagrams/block/blockDB.js';
import type { Block } from 'mermaid/dist/diagrams/block/blockTypes.js';
import type { GraphMetadata } from './model.js';
import { swimlaneRoute, roundedRoute, crossesBox, type RouteBox, type RoutePoint } from './swimlane-route.js';

/** Native block columns and spans; no second list of diagram nodes or relationships is authored. */
export interface BlockGrid { id: string; type?: string; columns: number; span: number; children: BlockGrid[] }
const invisible = new Set(['edge', 'column-setting', 'classDef', 'applyClass', 'applyStyles']);

/** Snapshot only grid syntax before Mermaid reuses its mutable diagram database. */
export function blockGrid(db: BlockDB): BlockGrid {
  const read = (node: Block): BlockGrid => ({
    id: node.id, type: node.type, columns: node.columns || 0, span: node.widthInColumns || 1,
    children: (node.children || []).filter(child => !invisible.has(child.type || '')).map(read),
  });
  const blocks = db.getBlocks();
  return blocks.length === 1 && blocks[0].id === 'root' ? read(blocks[0]) : { id: 'root', columns: 1, span: 1, children: blocks.filter(child => !invisible.has(child.type || '')).map(read) };
}

interface Size { width: number; height: number }
interface Cell { node: BlockGrid; column: number; row: number }

function cells(node: BlockGrid): { columns: number; entries: Cell[] } {
  const columns = node.columns > 0 ? node.columns : node.children.reduce((sum, child) => sum + child.span, 0);
  let cursor = 0;
  const entries = node.children.map(child => {
    if (child.span > columns) throw new Error(`泳道网格 ${node.id} 的 ${child.id} 跨度超过列数`);
    if (cursor % columns + child.span > columns) cursor += columns - cursor % columns;
    const entry = { node: child, column: cursor % columns, row: Math.floor(cursor / columns) };
    cursor += child.span;
    return entry;
  });
  return { columns, entries };
}

/** Lay out explicitly marked native block swimlanes, keeping all native cards, labels and edges. */
export function layoutSwimlanes(source: string, grid: BlockGrid, metadata: GraphMetadata): string {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none';
  host.innerHTML = source; document.body.append(host);
  try {
    const svg = host.querySelector('svg');
    if (!svg) throw new Error('Mermaid 泳道图未返回 SVG');
    const byId = new Map([...svg.querySelectorAll<SVGGElement>('g[id]')].map(node => [node.id, node]));
    const nodes = new Map([...metadata.elements.values()].filter(item => !item.from).map(item => [item.dataId, byId.get(item.domId || '')!]));
    const measurements = new Map<string, Size>(), boxes = new Map<string, RouteBox>(), headings: RouteBox[] = [];
    const edgeLabels = [...svg.querySelectorAll<SVGGraphicsElement>('.edgeLabel')].map(label => label.getBBox());
    const gapX = Math.max(48, ...edgeLabels.map(label => label.width + 20));
    const gapY = Math.max(48, ...edgeLabels.map(label => label.height + 24));
    const inset = 16, header = 30;
    function labelSize(id: string): Size {
      const label = nodes.get(id)?.querySelector<SVGGraphicsElement>(':scope > .label');
      const box = label?.getBBox();
      return box ? { width: box.width, height: box.height } : { width: 0, height: 0 };
    }
    function measure(node: BlockGrid): Size {
      let result: Size;
      if (node.type === 'space') result = { width: 0, height: 0 };
      else if (!node.children.length) {
        const label = labelSize(node.id);
        result = { width: label.width + 48, height: label.height + 32 };
      } else {
        const { columns, entries } = cells(node), rows = new Map<number, number>();
        let unit = 0;
        for (const entry of entries) {
          const size = measure(entry.node);
          unit = Math.max(unit, (size.width - gapX * (entry.node.span - 1)) / entry.node.span);
          rows.set(entry.row, Math.max(rows.get(entry.row) || 0, size.height));
        }
        const padding = node.id === 'root' ? 0 : inset, title = node.id === 'root' ? 0 : header;
        result = { width: Math.max(unit * columns + gapX * (columns - 1) + padding * 2, labelSize(node.id).width + padding * 2), height: [...rows.values()].reduce((sum, height) => sum + height, 0) + gapY * (rows.size - 1) + padding * 2 + title };
      }
      measurements.set(node.id, result);
      return result;
    }
    function place(node: BlockGrid, x: number, y: number, width: number): void {
      const size = measurements.get(node.id)!, element = nodes.get(node.id);
      if (node.type === 'space') return;
      const box = { x, y, width, height: size.height };
      if (element) {
        boxes.set(node.id, box);
        element.setAttribute('transform', `translate(${x + width / 2},${y + size.height / 2})`);
        const rect = element.querySelector(':scope > rect.label-container');
        if (rect) {
          rect.setAttribute('x', String(-width / 2)); rect.setAttribute('y', String(-size.height / 2));
          rect.setAttribute('width', String(width)); rect.setAttribute('height', String(size.height));
        } else {
          // Resize native outlines independently of their labels, including database cylinders.
          const outlines = [...element.children].filter((child): child is SVGGraphicsElement => child instanceof SVGGraphicsElement && !child.classList.contains('label'));
          if (!outlines.length) throw new Error(`泳道网格节点 ${node.id} 缺少原生轮廓`);
          const shape = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          element.prepend(shape); shape.append(...outlines);
          const original = shape.getBBox();
          if (!original.width || !original.height) throw new Error(`泳道网格节点 ${node.id} 的原生轮廓没有尺寸`);
          shape.setAttribute('transform', `translate(${-width / 2},${-size.height / 2}) scale(${width / original.width},${size.height / original.height}) translate(${-original.x},${-original.y})`);
          for (const outline of shape.querySelectorAll('path,rect,ellipse,polygon')) outline.setAttribute('vector-effect', 'non-scaling-stroke');
        }
        const label = element.querySelector<SVGGraphicsElement>(':scope > .label');
        if (label) {
          const text = label.getBBox();
          const labelX = node.children.length ? -width / 2 + 16 : -text.width / 2 - text.x;
          const labelY = node.children.length ? -size.height / 2 + 7 : -text.height / 2 - text.y;
          label.setAttribute('transform', `translate(${labelX},${labelY})`);
          if (node.children.length) headings.push({ x: x + 12, y: y + 5, width: text.width + 8, height: text.height + 8 });
        }
      }
      if (!node.children.length) return;
      const { columns, entries } = cells(node), padding = node.id === 'root' ? 0 : inset;
      const unit = (width - padding * 2 - gapX * (columns - 1)) / columns;
      const rowHeights = new Map<number, number>();
      for (const entry of entries) rowHeights.set(entry.row, Math.max(rowHeights.get(entry.row) || 0, measurements.get(entry.node.id)!.height));
      let rowY = y + padding + (node.id === 'root' ? 0 : header);
      for (const [row, height] of rowHeights) {
        for (const entry of entries.filter(entry => entry.row === row)) {
          const childHeight = measurements.get(entry.node.id)!.height;
          place(entry.node, x + padding + entry.column * (unit + gapX), rowY + (height - childHeight) / 2, unit * entry.node.span + gapX * (entry.node.span - 1));
        }
        rowY += height + gapY;
      }
    }
    const size = measure(grid); place(grid, 0, 0, size.width);
    const leaves = [...metadata.elements.values()].filter(item => item.ref.startsWith('node:'));
    const obstacles = [...leaves.map(item => boxes.get(item.dataId)!), ...headings];
    const occupied: RoutePoint[][] = [];
    for (const edge of metadata.elements.values()) if (edge.from && edge.to) {
      const from = boxes.get(edge.from), to = boxes.get(edge.to), path = svg.querySelector<SVGPathElement>(`[id="${edge.domId}"]`);
      if (!from || !to || !path) throw new Error(`泳道关系 ${edge.label} 缺少原生图元`);
      let points: RoutePoint[];
      try { points = swimlaneRoute(from, to, obstacles, occupied); }
      catch (error) { throw new Error(`${edge.from} → ${edge.to}: ${error instanceof Error ? error.message : String(error)}`); }
      path.setAttribute('d', roundedRoute(points)); path.setAttribute('data-ccv-route', JSON.stringify(points));
      occupied.push(points);
      const inner = [...svg.querySelectorAll<SVGElement>('.edgeLabel [data-id]')].find(label => label.getAttribute('data-id') === edge.dataId);
      const label = inner?.closest<SVGGraphicsElement>('.edgeLabel');
      if (label) {
        const labelBox = label.getBBox();
        const candidates = points.slice(1).map((point, i) => ({ a: points[i], b: point })).sort((a, b) => (Math.abs(b.b[0] - b.a[0]) + Math.abs(b.b[1] - b.a[1])) - (Math.abs(a.b[0] - a.a[0]) + Math.abs(a.b[1] - a.a[1])));
        let placed = false;
        for (const segment of candidates.flatMap(segment => [0.5, 0.35, 0.65].map(position => ({ ...segment, position })))) {
          const x = segment.a[0] + (segment.b[0] - segment.a[0]) * segment.position, y = segment.a[1] + (segment.b[1] - segment.a[1]) * segment.position;
          const target = { x: x - labelBox.width / 2 - 6, y: y - labelBox.height / 2 - 4, width: labelBox.width + 12, height: labelBox.height + 8 };
          if (obstacles.some(box => target.x < box.x + box.width && target.x + target.width > box.x && target.y < box.y + box.height && target.y + target.height > box.y)) continue;
          if (occupied.slice(0, -1).some(route => route.slice(1).some((point, i) => crossesBox(route[i], point, target)))) continue;
          label.setAttribute('transform', `translate(${x},${y})`); obstacles.push(target); placed = true; break;
        }
        if (!placed) throw new Error(`泳道关系 ${edge.label} 的文字没有可读的放置位置`);
      }
    }
    const points = [...boxes.values()].flatMap(box => [[box.x, box.y], [box.x + box.width, box.y + box.height]] as RoutePoint[]).concat(occupied.flat());
    const left = Math.min(0, ...points.map(point => point[0])) - 24, top = Math.min(0, ...points.map(point => point[1])) - 24;
    const width = Math.max(size.width, ...points.map(point => point[0])) - left + 24, height = Math.max(size.height, ...points.map(point => point[1])) - top + 24;
    svg.setAttribute('viewBox', `${left} ${top} ${width} ${height}`); svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height));
    return svg.outerHTML;
  } finally { host.remove(); }
}
