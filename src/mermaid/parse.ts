import type { Mermaid } from 'mermaid';
import type { FlowDB } from 'mermaid/dist/diagrams/flowchart/flowDb.js';
import type { SequenceDB } from 'mermaid/dist/diagrams/sequence/sequenceDb.js';
import type { BlockDB } from 'mermaid/dist/diagrams/block/blockDB.js';
import { DocumentError, type MermaidSource } from '../core/model.js';
import type { ParsedDiagram } from '../core/graph.js';
import { flowchartMetadata } from './adapters/flowchart.js';
import { blockMetadata } from './adapters/block.js';
import { sequenceMetadata } from './adapters/sequence.js';
import type { GraphMetadata } from './model.js';
import { withMermaid } from './engine.js';

/** Native identities are used only by adapters and never exposed as semantic identities. */
export async function readMermaidMetadata(engine: Mermaid, input: MermaidSource, id = 'semantic'): Promise<{ metadata: GraphMetadata; nativeType: string }> {
  const diagram = await engine.mermaidAPI.getDiagramFromText(input.source);
  let metadata: GraphMetadata = { type: input.type, elements: new Map(), groups: [] };
  if (input.type === 'flowchart') {
    if (!('getVertices' in diagram.db)) throw new Error('Mermaid 流程图解析接口不兼容');
    metadata = flowchartMetadata(diagram.db as FlowDB);
  } else if (input.type === 'block') {
    if (!('getBlocksFlat' in diagram.db)) throw new Error('Mermaid 分块图解析接口不兼容');
    metadata = blockMetadata(diagram.db as BlockDB, id);
  } else if (input.type === 'sequence') {
    if (!('getMessages' in diagram.db)) throw new Error('Mermaid 时序图解析接口不兼容');
    metadata = await sequenceMetadata(engine, input, diagram.db as SequenceDB);
  }
  return { metadata, nativeType: diagram.type };
}

/** Parse Mermaid without Markdown, reading HTML, Vue, renderer selection or theme configuration. */
export function parseMermaid(source: MermaidSource): Promise<ParsedDiagram> {
  const input: MermaidSource = { source: source.source, type: source.type, location: { ...source.location } };
  return withMermaid({}, async engine => {
    try {
      const { metadata, nativeType } = await readMermaidMetadata(engine, input);
      return {
        input, nativeType,
        graph: {
          type: metadata.type,
          elements: new Map([...metadata.elements].map(([ref, { dataId: _dataId, domId: _domId, ...item }]) => [ref, item])),
          groups: metadata.groups,
        },
      };
    } catch (error) {
      if (error instanceof DocumentError) throw error;
      throw new DocumentError(input.location, error instanceof Error ? error.message : String(error));
    }
  });
}
