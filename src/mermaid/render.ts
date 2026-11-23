import type { FlowDB } from 'mermaid/dist/diagrams/flowchart/flowDb.js';
import type { BlockDB } from 'mermaid/dist/diagrams/block/blockDB.js';
import type { MermaidConfig } from 'mermaid';
import { DocumentError, type MermaidSource } from '../core/model.js';
import { flowchartView } from './adapters/flowchart.js';
import type { GraphMetadata } from './model.js';
import type { ClearcodeTheme } from '../themes/model.js';
import { readMermaidMetadata } from './parse.js';
import { withMermaid } from './engine.js';
import { blockGrid, layoutSwimlanes } from './swimlanes.js';

/** Native output is private to Mermaid-backed renderers. */
export interface NativeRenderResult { svg: string; metadata: GraphMetadata }

/** Backend-owned spacing settings do not enter authored Markdown or semantic identity. */
export type NativeRenderProfile = Pick<MermaidConfig, 'flowchart' | 'block' | 'sequence'>;

/** Draw the lossless source with the existing custom layout and visual settings. */
export function renderMermaid(input: MermaidSource, id: string, collapsed: Record<string, boolean> | undefined, theme: ClearcodeTheme, profile: NativeRenderProfile = {}): Promise<NativeRenderResult> {
  return withMermaid({
    ...theme.mermaid, fontFamily: theme.variables['--ccv-font'],
    layout: input.type === 'flowchart' ? 'ccv-elk' : 'elk',
    elk: { straightenEdges: true },
    flowchart: { htmlLabels: false, useMaxWidth: false, nodeSpacing: 38, rankSpacing: 72, padding: 22, curve: 'linear', ...profile.flowchart },
    block: { padding: 18, useMaxWidth: false, ...profile.block },
    sequence: { useMaxWidth: false, showSequenceNumbers: true, actorMargin: 28, messageMargin: 40, width: 104, wrap: true, mirrorActors: true, ...profile.sequence },
  }, async engine => {
    try {
      const { metadata } = await readMermaidMetadata(engine, input, id);
      const source = input.type === 'flowchart' ? flowchartView(input.source, metadata.groups, collapsed) : input.source;
      const swimlanes = input.type === 'block' && [...metadata.elements.values()].some(item => item.classes?.includes('ccv-swimlane'));
      const grid = swimlanes ? blockGrid((await engine.mermaidAPI.getDiagramFromText(source)).db as BlockDB) : undefined;
      if (input.type === 'flowchart') {
        const displayed = await engine.mermaidAPI.getDiagramFromText(source);
        const db = displayed.db as FlowDB;
        db.setDiagramId(id);
        for (const node of db.getData().nodes) {
          const item = metadata.elements.get(`group:${node.id}`) || metadata.elements.get(`node:${node.id}`);
          if (item) item.domId = `${id}-${node.domId || node.id}`;
        }
      }
      const result = await engine.render(id, source);
      return { svg: grid ? layoutSwimlanes(result.svg, grid, metadata) : result.svg, metadata };
    } catch (error) {
      if (error instanceof DocumentError) throw error;
      throw new DocumentError(input.location, error instanceof Error ? error.message : String(error));
    }
  }, true);
}
