import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import postcss from 'postcss';
import { patchSequenceRenderer } from './patch-sequence.mjs';

const sourceRoot = path.resolve(process.argv[2] || '../archify-source');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim();
const expected = '7e45f36c66de1254d5ad6ba1d878f6499ea269fd';
if (commit !== expected) throw new Error(`Expected Archify ${expected}, received ${commit}`);
const source = path.join(sourceRoot, 'archify'), target = path.resolve('src/renderers/archify/upstream');
const records = [], visited = new Set();
const read = relative => {
  const bytes = fs.readFileSync(path.join(source, relative));
  records.push({ file: relative, sha256: createHash('sha256').update(bytes).digest('hex') });
  return bytes.toString('utf8').replaceAll('\r\n', '\n');
};
const write = (relative, content) => {
  const file = path.join(target, relative); fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '// Adapted from tt-a1i/archify; see ../NOTICE.md and sources.json.\n' + content.trimEnd() + '\n');
};
function browserShared(relative, text) {
  if (relative === 'shared/cli.mjs') return `import { esc } from './utils.mjs';\nimport { throwDiagnosticProblems } from './diagnostics.mjs';\nimport { resolveLocale, translateMessage } from './i18n.mjs';\n` + text.slice(text.indexOf('const SEMANTIC_COLLECTIONS =')).replace('process.env.ARCHIFY_QUALITY_PROFILE || ', '');
  if (relative === 'shared/diagnostics.mjs') return text.slice(text.indexOf('const DIAGNOSTIC_MODE'), text.indexOf('// Match the public CLI')).replace("process.env.ARCHIFY_DIAGNOSTIC_FORMAT === 'json'", 'true').replace('process.argv[2] ? path.resolve(process.argv[2]) : undefined', 'undefined');
  if (relative === 'shared/brand-marks.mjs') {
    const header = `import { BRAND_MARKS } from './generated-brand-marks.mjs';\nimport { esc, textUnits } from './utils.mjs';\nconst MARK_BY_LOOKUP = new Map(), MARK_BY_DOMAIN = new Map();\n`;
    const lookup = text.slice(text.indexOf('function lookupForms'), text.indexOf('export function listBrandMarks'));
    const drawing = text.slice(text.indexOf('export function brandMetadataFor'));
    return header + lookup + `\nexport function brandMarkFor(node) {\n  if (!node?.brand) return null;\n  if (typeof node.brand !== 'string') throw new Error('Archify browser rendering supports bundled brand IDs only');\n  const mark = findBrandMark(node.brand);\n  if (!mark) throw new Error('Unknown bundled brand: ' + node.brand);\n  return { ...mark, kind: 'preset', status: 'preset', sourceUrl: mark.provenance.source };\n}\n` + drawing;
  }
  return text.replaceAll('process.env.ARCHIFY_QUALITY_PROFILE || ', '').replace('Buffer.byteLength(segment, \'utf8\')', 'new TextEncoder().encode(segment).length');
}
function copy(relative) {
  if (visited.has(relative)) return;
  visited.add(relative);
  let text = read('renderers/' + relative);
  if (relative === 'shared/i18n.mjs') {
    const manifest = JSON.parse(read('locales/manifest.json')), catalogs = { 'manifest.json': manifest };
    for (const item of manifest.catalogs) catalogs[item.file] = JSON.parse(read('locales/' + item.file));
    text = text.replace(/^import .*\n/gm, '').replace(/^const LOCALES_DIR[^\n]*\n/gm, '');
    const start = text.indexOf('function readLocaleData(file)'), end = text.indexOf('function loadManifest()');
    text = text.slice(0, start) + `const localeData = ${JSON.stringify(catalogs)};\nfunction readLocaleData(file) { if (!localeData[file]) throw new Error('Unknown bundled locale: '+file); return localeData[file]; }\n\n` + text.slice(end);
  } else text = browserShared(relative, text);
  if (relative === 'workflow/workflow-compiler.mjs') {
    const start = text.indexOf('function renderPhase(phase) {'), end = text.indexOf('function renderGroup(', start);
    const body = text.slice(start, end).replace('return `', 'return `<g data-archify-phase="${esc(phase.id)}">').replace('`;\n}', '</g>`;\n}');
    text = text.slice(0, start) + body + text.slice(end);
  }
  for (const match of text.matchAll(/^import[\s\S]*?from ['"]([^'"\n]+)['"];?/gm)) {
    if (match[1].startsWith('node:')) throw new Error('Unexpected Node dependency in ' + relative + ': ' + match[1]);
    if (match[1].startsWith('.')) copy(path.posix.normalize(path.posix.join(path.posix.dirname(relative), match[1])));
  }
  write(relative, text);
}
const variables = { architecture: 'arch', sequence: 'sequence', lifecycle: 'lifecycle', erd: 'er', class: 'cd', tree: 'tree', timeline: 'tl', waterfall: 'wf' };
for (const [kind, variable] of Object.entries(variables)) {
  const relative = `${kind}/render-${kind}.mjs`;
  let text = read('renderers/' + relative), imports = [];
  text = text.replace(/^import[\s\S]*?from ['"]([^'"\n]+)['"];?\n/gm, (statement, specifier) => {
    if (!specifier.startsWith('node:')) imports.push(statement.replace(/\b(?:loadDiagramWithBrandMarks|loadDiagram|writeDiagram),?\s*/g, ''));
    return '';
  });
  text = text.replace(/^const __dirname[^\n]*\n/gm, '').replace(/^const (?:layoutJsonMode|cliArgs)[^\n]*\n/gm, '');
  text = text.replace(/const \{ diagram: \w+, template, outPath, sourceEvidence \} = (?:await )?loadDiagram(?:WithBrandMarks)?\(\{[\s\S]*?\}\);\n/, '').replaceAll('process.env.ARCHIFY_QUALITY_PROFILE || ', '');
  let end = text.lastIndexOf('\nif (layoutJsonMode) {');
  if (end < 0) end = text.lastIndexOf('\nwriteDiagram({');
  if (end < 0) throw new Error('Cannot find renderer entry for ' + kind);
  text = text.slice(0, end);
  if (kind === 'architecture') text += '\nvalidateArchitecture();';
  if (kind === 'sequence') text = patchSequenceRenderer(text);
  if (kind === 'sequence') text = text.replace('return `        <path d="M ${participant.cx} ${layout.lifelineTop}', 'return `        <path data-archify-lifeline="${esc(participant.id)}" data-lifeline-end="${end}" d="M ${participant.cx} ${layout.lifelineTop}');
  for (const statement of imports) for (const match of statement.matchAll(/from ['"]([^'"]+)['"]/g)) if (match[1].startsWith('.')) copy(path.posix.normalize(path.posix.join(kind, match[1])));
  write(relative, imports.join('') + `\nexport function render(input) {\nconst ${variable} = input, sourceEvidence = null, layoutJsonMode = false;\n` + text + '\nreturn { svg: renderSvg(), report: typeof buildLayoutReport === "function" ? buildLayoutReport() : undefined };\n}\n');
  fs.writeFileSync(path.join(target, `${kind}/render-${kind}.d.mts`), 'import type { ArchifyDocument, ArchifyOutput } from "../../model.js";\nexport function render(input: ArchifyDocument): ArchifyOutput;\n');
}
for (const kind of ['workflow', 'dataflow']) {
  copy(`${kind}/${kind}-compiler.mjs`);
  write(`${kind}/render-${kind}.mjs`, kind === 'workflow'
    ? `import { compileWorkflow } from './workflow-compiler.mjs';\nexport function render(input) { const result = compileWorkflow({ workflow: input, qualityProfile: input.meta?.quality_profile }); if (!result.ok) { const error = new Error(result.error || 'Workflow compilation failed'); error.archifyDiagnostics = result.diagnostics; throw error; } return { svg: result.svg, report: result.receipt }; }\n`
    : `import { compileDataflow } from './dataflow-compiler.mjs';\nexport function render(input) { return { svg: compileDataflow({ dataflow: input, qualityProfile: input.meta?.quality_profile }) }; }\n`);
  fs.writeFileSync(path.join(target, `${kind}/render-${kind}.d.mts`), 'import type { ArchifyDocument, ArchifyOutput } from "../../model.js";\nexport function render(input: ArchifyDocument): ArchifyOutput;\n');
}
const template = read('assets/template.html'), styles = [...template.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
const font = styles[0][1], sheet = postcss.parse(styles[1][1]), palettes = {};
sheet.walkRules(rule => {
  if (rule.parent.type === 'root' && (rule.selectors.includes(':root') || rule.selector === '[data-theme="light"]')) {
    const key = rule.selectors.includes(':root') ? 'dark' : 'light'; palettes[key] ||= {};
    rule.walkDecls(declaration => { if (declaration.prop.startsWith('--')) palettes[key][declaration.prop] = declaration.value; });
  }
  if (rule.selectors.includes(':root') || rule.selector === '[data-theme="light"]') { rule.remove(); return; }
  if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
  rule.selectors = rule.selectors.map(selector => {
    // Paint rules tied to the standalone HTML shell also apply to embedded SVG roots.
    const embedded = selector.match(/^html(.+?) \.diagram-container\s*>\s*svg(\s+.+)$/);
    const drawing = embedded ? 'svg' + embedded[1] + embedded[2] : selector;
    return ':where(.ccv[data-renderer="archify"] .ccv-stage) ' + drawing;
  });
});
if (!palettes.dark || !palettes.light) throw new Error('Missing official light/dark palette');
fs.writeFileSync('src/themes/archify-upstream.css', '/* Archify pinned drawing styles; licenses: renderers/archify/ */\n' + font + '\n' + sheet.toString() + '\n');
write('palette.mjs', 'export const palettes = ' + JSON.stringify(palettes, null, 2) + ';\n');
fs.writeFileSync(path.join(target, 'palette.d.mts'), 'export const palettes: Record<"light"|"dark", Record<string,string>>;\n');
fs.writeFileSync(path.join(target, 'shared/text-fit.d.mts'), 'export function minimumNodeTextWidth(text: string, minimum: number): number;\n');
fs.writeFileSync(path.join(target, 'sources.json'), JSON.stringify({ repository: 'https://github.com/tt-a1i/archify', commit, files: records }, null, 2) + '\n');
console.log(`Adapted ${visited.size} shared modules and 10 renderers from ${commit.slice(0, 12)}.`);
