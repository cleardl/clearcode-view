import { z } from 'zod';
import { DocumentError, type MermaidSource } from '../core/model.js';
import { archifyKinds } from '../renderers/archify/model.js';

const diagram = z.object({ kind: z.enum(archifyKinds), locale: z.string().optional(), timezone: z.string().optional(), unit: z.string().optional(), evidence: z.string().optional(), legend: z.record(z.string(), z.string()).optional() }).strict();
const element = z.object({
  kind: z.string().optional(), variant: z.enum(['default', 'emphasis', 'dashed', 'security', 'return']).optional(),
  role: z.enum(['main', 'branch', 'error', 'return']).optional(), sublabel: z.string().optional(), tag: z.string().optional(),
  detail: z.string().optional(), brand: z.string().optional(), icon: z.string().optional(), step: z.string().optional(),
  parent: z.string().optional(), classification: z.string().optional(), main: z.boolean().optional(),
}).strict();
const groupAttributes = element.extend({ variant: z.enum(['default', 'emphasis', 'dashed', 'security', 'return', 'exception']).optional() });
export type SemanticAttributes = z.infer<typeof element>;
export type GroupAttributes = z.infer<typeof groupAttributes>;
export interface DiagramAnnotations {
  diagram?: z.infer<typeof diagram>;
  nodes: Map<string, SemanticAttributes>;
  edges: Map<string, SemanticAttributes>;
  groups: Map<string, GroupAttributes>;
}

/** Read additive semantic attributes; geometry, styling and duplicate topology are rejected. */
export function diagramAnnotations(input: MermaidSource): DiagramAnnotations {
  const result: DiagramAnnotations = { nodes: new Map(), edges: new Map(), groups: new Map() };
  for (const [index, line] of input.source.split(/\r?\n/).entries()) {
    const match = line.match(/^\s*%%\s*ccv:(diagram|node|edge|group)\s+(?:(\S+)\s+)?(\{.*\})\s*$/);
    if (!match) {
      if (/^\s*%%\s*ccv:(diagram|node|edge|group)\b/.test(line)) throw new DocumentError({ ...input.location, line: input.location.line + index }, '无效图语义声明：' + line.trim());
      continue;
    }
    try {
      const value: unknown = JSON.parse(match[3]);
      if (match[1] === 'diagram') {
        if (result.diagram) throw new Error('重复的图语义声明');
        if (match[2]) throw new Error('图语义声明不接受元素 ID');
        result.diagram = diagram.parse(value);
      } else {
        if (!match[2]) throw new Error('元素语义声明需要已有元素 ID');
        const collection = match[1] === 'node' ? result.nodes : match[1] === 'edge' ? result.edges : result.groups;
        if (collection.has(match[2])) throw new Error(`重复的元素语义声明：${match[2]}`);
        if (match[1] === 'group') result.groups.set(match[2], groupAttributes.parse(value));
        else (match[1] === 'node' ? result.nodes : result.edges).set(match[2], element.parse(value));
      }
    } catch (error) { throw new DocumentError({ ...input.location, line: input.location.line + index }, error instanceof Error ? error.message : String(error)); }
  }
  return result;
}
