import { archifyTheme } from './archify-theme.js';
import { archifyProjection } from './archify/projection.js';
import { drawArchify } from './archify/draw.js';
import { bindArchify, scopeArchifySvg } from './archify/bind.js';
import type { DiagramRenderer } from './model.js';

/** Visual presets belong to the host, independently of authored Mermaid content. */
export interface ArchifyPresentation { preset?: 'classic' | 'signal-flow' | 'blueprint' | 'editorial'; engineeringProfile?: string }
export interface ArchifyRendererOptions extends ArchifyPresentation { diagrams?: Record<string, ArchifyPresentation> }

/** Configure official presentation globally or by stable diagram ID, without adding UI fields to Markdown. */
export function createArchifyRenderer(options: ArchifyRendererOptions = {}): DiagramRenderer {
  return {
  id: 'archify', label: 'Archify 风格 · 丰富', resolveTheme: archifyTheme,
  supports: diagram => ['flowchart-v2', 'flowchart', 'block', 'sequence', 'er', 'classDiagram', 'stateDiagram', 'stateDiagram-v2', 'gantt'].includes(diagram.nativeType),
  async render(diagram, context) {
    const collapsed = context.collapsed || Object.fromEntries(diagram.graph.groups.map(group => [group.id, group.collapsed]));
    const projection = await archifyProjection(diagram, collapsed);
    const presentation = { ...options, ...options.diagrams?.[diagram.input.location.diagram || ''] };
    projection.document.meta.visual_preset = presentation.preset || 'classic';
    if (presentation.engineeringProfile) projection.document.meta.engineering_profile = presentation.engineeringProfile;
    const result = await drawArchify(projection.document);
    return { svg: result.svg, mount(svg) {
      scopeArchifySvg(svg, context.id); svg.setAttribute('data-archify-kind', projection.document.diagram_type); svg.setAttribute('role', 'group');
      svg.setAttribute('data-theme', context.theme.colorScheme || 'light');
      svg.setAttribute('data-motion', 'still');
      return { bindings: bindArchify(svg, projection, diagram, collapsed), legend: [], readingScale: 1 };
    } };
  },
  };
}

/** Classic Archify presentation; configurable hosts can use createArchifyRenderer. */
export const archifyRenderer = createArchifyRenderer();
