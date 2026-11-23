import { renderMermaid, type NativeRenderProfile } from '../mermaid/render.js';
import { bindDiagram } from '../mermaid/bind.js';
import { straightenFlowchart } from '../mermaid/straighten.js';
import type { GraphMetadata } from '../mermaid/model.js';
import type { DiagramRenderer, BoundElements, LegendEntry } from './model.js';

/** Presentation varies independently from lossless Mermaid layout and semantic binding. */
interface NativeRendererOptions {
  id: string;
  label: string;
  resolveTheme?: DiagramRenderer['resolveTheme'];
  profile?: NativeRenderProfile;
  present(svg: SVGSVGElement, metadata: GraphMetadata, bindings: BoundElements): LegendEntry[];
}

/** All built-in styles use the same source, group overrides, identities and mounting lifecycle. */
export function nativeRenderer(options: NativeRendererOptions): DiagramRenderer {
  return {
    id: options.id, label: options.label, resolveTheme: options.resolveTheme,
    supports: () => true,
    async render(diagram, context) {
      const result = await renderMermaid(diagram.input, context.id, context.collapsed, context.theme, options.profile);
      return {
        svg: result.svg,
        mount(svg) {
          if (diagram.graph.type === 'flowchart') straightenFlowchart(svg);
          const collapsed = context.collapsed || Object.fromEntries(diagram.graph.groups.map(group => [group.id, group.collapsed]));
          const bindings = bindDiagram(svg, result.metadata, collapsed);
          return { bindings, legend: options.present(svg, result.metadata, bindings) };
        },
      };
    },
  };
}
