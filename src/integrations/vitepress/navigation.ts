import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { z } from 'zod';
import { compileDocument, type CompiledMarkdown } from '../../protocol/parse.js';
import { readYaml } from '../../protocol/validate.js';
import { DocumentError } from '../../protocol/model.js';

/** A navigation item is either a document or a labelled group. */
export type NavigationItem = { label: string; file: string } | { label: string; items: NavigationItem[] };
const item: z.ZodType<NavigationItem> = z.lazy(() => z.union([
  z.object({ label: z.string().min(1), file: z.string().regex(/\.md$/) }).strict(),
  z.object({ label: z.string().min(1), items: z.array(item).min(1) }).strict(),
]));
const configSchema = z.object({ version: z.literal(1), title: z.string().min(1), navigation: z.array(item).min(1) }).strict();

/** Loaded navigation and the documents it explicitly references. */
export interface NavigationProject { root: string; title: string; navigation: NavigationItem[]; documents: Map<string, CompiledMarkdown> }

function documentPath(root: string, file: string, owner: string): string {
  const target = resolve(root, file), rel = relative(root, target);
  if (isAbsolute(file) || rel === '..' || rel.startsWith('..\\') || rel.startsWith('../')) throw new DocumentError({ file: owner, line: 1 }, `文档超出根目录：${file}`);
  if (!existsSync(target)) throw new DocumentError({ file: owner, line: 1 }, `文档不存在：${file}`);
  return target;
}

/** Load the text navigation and validate local graph-to-document references. */
export function loadNavigation(rootDirectory: string, configFile = 'clearcode.config.yaml'): NavigationProject {
  const root = resolve(rootDirectory), configPath = documentPath(root, configFile, configFile);
  const result = configSchema.safeParse(readYaml(readFileSync(configPath, 'utf8'), { file: configPath, line: 1 }));
  if (!result.success) throw new DocumentError({ file: configPath, line: 1 }, result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  const documents = new Map<string, CompiledMarkdown>();
  const load = (path: string): CompiledMarkdown => {
    const known = documents.get(path);
    if (known) return known;
    const compiled = compileDocument(readFileSync(path, 'utf8'), { file: path });
    documents.set(path, compiled);
    return compiled;
  };
  const visit = (items: NavigationItem[]) => items.forEach(entry => {
    if ('file' in entry) load(documentPath(root, entry.file, configPath));
    else visit(entry.items);
  });
  visit(result.data.navigation);
  for (const [owner, document] of documents) for (const graph of document.diagrams) for (const href of Object.values(graph.links)) {
    if (!href) continue;
    const [file, fragment] = href.split('#');
    const target = file ? documentPath(root, relative(root, resolve(dirname(owner), decodeURIComponent(file))), owner) : owner;
    const linked = load(target);
    if (fragment && !linked.anchors.includes(decodeURIComponent(fragment))) throw new DocumentError(graph.location, `关联文档锚点不存在：${href}`);
  }
  return { root, title: result.data.title, navigation: result.data.navigation, documents };
}
