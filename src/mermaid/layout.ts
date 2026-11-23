import type { LayoutData, LayoutLoaderDefinition } from 'mermaid';

const individualSpacing = [
  'spacing.nodeNode:88',
  'spacing.edgeNode:48',
].join(';,;');

/** Reserve space around nodes through ELK's individual spacing options. */
export function spaceFlowchart(data: LayoutData): void {
  for (const node of data.nodes) if (!node.isGroup) {
    const spaced = node as typeof node & { layoutOptions?: Record<string, unknown> };
    spaced.layoutOptions = { ...spaced.layoutOptions, 'elk.spacing.individual': individualSpacing };
  }
}

/** Delegate routing and painting to Mermaid's maintained ELK implementation. */
export function spacedElk(loader: LayoutLoaderDefinition): LayoutLoaderDefinition {
  return { ...loader, loader: async () => {
    const implementation = await loader.loader();
    return { render(data, ...args) {
      spaceFlowchart(data);
      return implementation.render(data, ...args);
    } };
  } };
}
