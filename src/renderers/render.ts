import { DocumentError } from '../core/model.js';
import { visibleReference, type ParsedDiagram } from '../core/graph.js';
import type { DiagramRenderer, RendererContext, RenderedScene, MountedDiagram } from './model.js';

/** Unsupported content fails explicitly instead of silently selecting a different renderer. */
export async function renderScene(renderer: DiagramRenderer, diagram: ParsedDiagram, context: RendererContext): Promise<RenderedScene> {
  try {
    if (!renderer.supports(diagram)) throw new Error(`渲染后端 ${renderer.id} 不支持 ${diagram.nativeType}`);
    const theme = renderer.resolveTheme?.(context.theme) || context.theme;
    return await renderer.render(diagram, { ...context, theme });
  } catch (error) {
    if (error instanceof DocumentError) throw error;
    throw new DocumentError(diagram.input.location, error instanceof Error ? error.message : String(error));
  }
}

/** All indexed visible semantics must remain addressable after mounting a backend. */
export function validateMountedDiagram(diagram: ParsedDiagram, mounted: MountedDiagram, collapsed: Record<string, boolean>): void {
  for (const ref of diagram.graph.elements.keys()) {
    const visible = visibleReference(ref, diagram.graph, collapsed);
    if (!mounted.bindings.get(visible)?.length) throw new DocumentError(diagram.input.location, `渲染结果缺少图元素：${visible}`);
  }
  for (const ref of mounted.bindings.keys()) if (!diagram.graph.elements.has(ref)) throw new DocumentError(diagram.input.location, `渲染结果包含未知图元素：${ref}`);
}
