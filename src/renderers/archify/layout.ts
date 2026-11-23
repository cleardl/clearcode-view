import type { ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { ArchifyNode, ArchifyRelation } from './model.js';

/** Automatic placement feeds the official drawing/router, without authored pixel coordinates. */
export async function placeCards(nodes: ArchifyNode[], relations: ArchifyRelation[], direction: string, sizes?: Map<string, { width: number; height: number }>, groups: { id: string; parent?: string; members: string[] }[] = []): Promise<void> {
  const [{ default: ELK }, { minimumNodeTextWidth }] = await Promise.all([
    import('elkjs/lib/elk.bundled.js'), import('./upstream/shared/text-fit.mjs'),
  ]);
  const engine = new ELK();
  // The bundled implementation uses its in-process worker facade, not a Web Worker.
    const graph: ElkNode = {
      id: 'root', layoutOptions: {
        'elk.algorithm': 'layered', 'elk.direction': ['LR', 'RL'].includes(direction) ? direction === 'LR' ? 'RIGHT' : 'LEFT' : direction === 'BT' ? 'UP' : 'DOWN',
        'elk.edgeRouting': 'ORTHOGONAL', 'elk.spacing.nodeNode': '100', 'elk.layered.spacing.nodeNodeBetweenLayers': '160',
        'elk.padding': '[top=80,left=80,bottom=80,right=80]', 'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES', 'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      },
      children: nodes.map(node => {
        const width = Math.max(140, Math.max(...[node.label, node.sublabel, node.tag].filter((s): s is string => !!s).map(s => minimumNodeTextWidth(s, 11))) + (node.brand ? 64 : 40));
        return { id: node.id, width: sizes?.get(node.id)?.width || width, height: sizes?.get(node.id)?.height || (node.tag ? 80 : 68) };
      }),
      edges: relations.filter(edge => edge.from !== edge.to).map(edge => ({ id: edge.id, sources: [edge.from], targets: [edge.to] })),
    };
    if (groups.length) {
      const leaves = new Map(graph.children!.map(node => [node.id, node]));
      const containers = new Map(groups.map(group => [group.id, { id: group.id, children: [] as ElkNode[], layoutOptions: { 'elk.padding': '[top=70,left=60,bottom=60,right=60]', 'elk.hierarchyHandling': 'INCLUDE_CHILDREN', 'elk.spacing.nodeNode': '100', 'elk.layered.spacing.nodeNodeBetweenLayers': '120' } }]));
      graph.children = [];
      for (const group of groups) (containers.get(group.parent || '')?.children || graph.children).push(containers.get(group.id)!);
      for (const node of nodes) {
        const owners = groups.filter(group => group.members.includes(node.id));
        const owner = owners.find(group => !owners.some(other => other.parent === group.id));
        (containers.get(owner?.id || '')?.children || graph.children).push(leaves.get(node.id)!);
      }
    }
    const output = await engine.layout(graph);
    const assign = (children: ElkNode[], x: number, y: number) => {
      for (const placed of children) {
        const px = x + placed.x!, py = y + placed.y!;
        if (placed.children) assign(placed.children, px, py);
        else { const node = nodes.find(node => node.id === placed.id)!; node.pos = [px, py]; node.size = [placed.width!, placed.height!]; node.width = placed.width; }
      }
    };
    assign(output.children!, 0, 0);
}
