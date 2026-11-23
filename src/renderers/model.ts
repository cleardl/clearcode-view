import type { ElementRef } from '../core/model.js';
import type { ParsedDiagram } from '../core/graph.js';
import type { ClearcodeTheme, SemanticRole } from '../themes/model.js';

/** Every selectable graphical target is associated with a semantic identity. */
export type BoundElements = Map<ElementRef, SVGElement[]>;

/** Backends supply their own legend without involving the content parser. */
export interface LegendEntry { id: string; label: string; role?: SemanticRole; line?: 'solid' | 'dashed' }

/** Presentation and view state are separate from diagram content. */
export interface RendererContext { id: string; collapsed?: Record<string, boolean>; theme: ClearcodeTheme }

/** Release listeners or other resources when this mounted drawing is replaced or removed. */
export interface MountedDiagram { bindings: BoundElements; legend: LegendEntry[]; readingScale?: number; dispose?: () => void }

/** Render releases temporary measurement resources; persistent resources start at mount, which rolls back if it throws. */
export interface RenderedScene { svg: string; mount(svg: SVGSVGElement): MountedDiagram }

/** A host-selected backend receives Mermaid semantics, never a Markdown document or reading HTML. */
export interface DiagramRenderer {
  id: string;
  label: string;
  /** Pure presentation derivation; preserve the host theme identity and never mutate it. */
  resolveTheme?: (theme: ClearcodeTheme) => ClearcodeTheme;
  supports(diagram: ParsedDiagram): boolean;
  render(diagram: ParsedDiagram, context: RendererContext): Promise<RenderedScene>;
}
