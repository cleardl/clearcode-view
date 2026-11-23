import { parseDocument } from 'yaml';
import { z } from 'zod';
import { DocumentError, type ElementRef, type SourceLocation } from './model.js';

export { validateDiagram } from '../core/validate.js';

const identifier = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*$/, '需要以字母开头的稳定 ID');
const element = z.custom<ElementRef>((value): value is ElementRef => typeof value === 'string' && /^(node|edge|group|participant|message):\S+$/.test(value), '无效的图元素引用');
const section = z.string().regex(/^#[^\s#]+$/, '需要当前文档的 #锚点');

/** Only reading metadata belongs here; diagram structure stays in Mermaid. */
export const viewSchema = z.object({
  version: z.literal(1),
  overview: section.optional(),
  details: z.record(element, section).default({}),
  links: z.record(element, z.string().min(1).refine(value => !/^[a-z]+:/i.test(value) && !value.startsWith('//') && !value.startsWith('/'), '关联文档需要相对路径')).default({}),
  steps: z.array(z.object({
    id: identifier,
    title: z.string().min(1),
    focus: z.array(element).min(1),
    ref: section.optional(),
  }).strict()).min(1).default([]),
}).strict();

/** Parse ordinary YAML with duplicate keys and alias expansion errors reported. */
export function readYaml(source: string, location: SourceLocation): unknown {
  const document = parseDocument(source, { uniqueKeys: true, prettyErrors: true });
  if (document.errors.length) throw new DocumentError(location, document.errors[0].message);
  try { return document.toJS({ maxAliasCount: 50 }); }
  catch (error) { throw new DocumentError(location, error instanceof Error ? error.message : String(error)); }
}

/** Validate metadata and preserve schema issue paths in the diagnostic. */
export function readView(source: string, location: SourceLocation): z.infer<typeof viewSchema> {
  const result = viewSchema.safeParse(readYaml(source, location));
  if (!result.success) throw new DocumentError(location, result.error.issues.map(issue => `${issue.path.join('.') || 'diagram-view'}: ${issue.message}`).join('; '));
  return result.data;
}

