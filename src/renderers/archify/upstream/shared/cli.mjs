// Adapted from tt-a1i/archify; see ../NOTICE.md and sources.json.
import { esc } from './utils.mjs';
import { throwDiagnosticProblems } from './diagnostics.mjs';
import { resolveLocale, translateMessage } from './i18n.mjs';
const SEMANTIC_COLLECTIONS = {
  architecture: 'components',
  workflow: 'nodes',
  sequence: 'participants',
  dataflow: 'nodes',
  lifecycle: 'states',
  erd: 'entities',
  tree: 'nodes',
  class: 'types',
  timeline: 'events',
  waterfall: 'spans',
};

const RELATIONSHIP_COLLECTIONS = {
  architecture: 'connections',
  workflow: 'edges',
  sequence: 'messages',
  dataflow: 'flows',
  lifecycle: 'transitions',
  erd: 'relationships',
  class: 'relationships',
};

// Relationship IDs are optional for backwards compatibility, but once an
// author supplies one it becomes the durable identity used by viewer links.
// Keep uniqueness enforcement in the shared zero-install path so every typed
// renderer fails the same way even when development dependencies are absent.
export function validateRelationshipIds(diagramType, diagram) {
  const collection = RELATIONSHIP_COLLECTIONS[diagramType];
  const relationships = collection && Array.isArray(diagram[collection]) ? diagram[collection] : [];
  const seen = new Set();
  const problems = [];

  relationships.forEach((relationship, index) => {
    if (relationship.id === undefined || relationship.id === null || relationship.id === '') return;
    if (seen.has(relationship.id)) {
      problems.push(`/${collection}/${index}/id duplicates relationship id ${JSON.stringify(relationship.id)}`);
    }
    seen.add(relationship.id);
  });

  if (problems.length) {
    throwDiagnosticProblems('Relationship identity validation failed', problems, {
      code: 'relationship/duplicate-id',
      subject: { diagramType, collection },
    });
  }
}

// Share relationship-ID semantic checks between the loader
// and workflow compiler without performing filesystem operations (see #429).
export function validateCrossCollectionContracts(diagramType, diagram) {
  validateRelationshipIds(diagramType, diagram);
}

// Accessible name for the generated diagram SVG.
export function svgRootAttrs(meta, explicitQualityProfile) {
  // Motion is a Viewer capability for every diagram; Live/Still controls playback.
  const animation = ' data-animation="trace"';
  const preset = ` data-preset="${esc(meta.visual_preset || 'classic')}"`;
  const engineeringProfile = meta.engineering_profile
    ? ` data-engineering-profile="${esc(meta.engineering_profile)}"`
    : '';
  const requestedProfile = explicitQualityProfile || meta.quality_profile;
  const qualityProfile = requestedProfile === 'showcase' ? 'showcase' : 'standard';
  const advisory = requestedProfile ? '' : ' data-quality-gates="advisory"';
  return `role="img" lang="${esc(resolveLocale(meta.locale))}" aria-labelledby="archify-diagram-title archify-diagram-description"${animation}${preset}${engineeringProfile} data-quality-profile="${esc(qualityProfile)}"${advisory}`;
}

// Keep the accessible name inside the SVG so it survives standalone SVG
// export and embedding. The fixed IDs are deterministic because an Archify
// artifact intentionally contains one primary diagram SVG.
export function svgAccessibleText(meta, kind) {
  const description = meta.subtitle || translateMessage(meta.locale, `diagram.description.${kind}`);
  return `        <title id="archify-diagram-title">${esc(meta.title)}</title>\n        <desc id="archify-diagram-description">${esc(description)}</desc>`;
}

export function animateAttr(meta, kind, step) {
  // Ambient trace must finish inside the fixed six-second WebM capture. The
  // cap affects visual delay only; authored order and semantic identity stay
  // untouched in the JSON, DOM, and relationship contracts.
  const safeStep = Number.isFinite(step) && step >= 0 ? Math.min(12, Math.floor(step)) : 0;
  return ` data-animate="${kind}" style="--step:${safeStep}"`;
}

// Stable semantic hooks for the standalone HTML explorer. IDs already pass
// the schema's conservative identifier pattern; escape again at the markup
// boundary so these helpers remain safe if that contract expands later.
export function focusNodeAttrs(id, label, metadata = {}, locale) {
  const optional = [
    ['data-node-kind', metadata.kind],
    ['data-node-sublabel', metadata.sublabel],
    ['data-node-tag', metadata.tag],
    ['data-node-context', metadata.context],
    ['data-node-brand', metadata.brand],
    ['data-node-brand-id', metadata.brandId],
    ['data-node-brand-status', metadata.brandStatus],
    ['data-node-brand-source', metadata.brandSource],
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([name, value]) => ` ${name}="${esc(String(value))}"`)
    .join('');
  const detail = [metadata.sublabel, metadata.context, metadata.brand]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .join(', ');
  const aria = detail
    ? translateMessage(locale, 'node.focus.detail', { label, detail })
    : translateMessage(locale, 'node.focus', { label });
  return `id="node-${esc(id)}" data-node-id="${esc(id)}" data-node-label="${esc(label)}" tabindex="0" role="button" aria-label="${esc(aria)}" aria-pressed="false"${optional}`;
}

// Native SVG titles preserve a compact details-on-demand fallback when the
// canonical SVG is embedded inline outside the full Archify viewer.
export function focusNodeTitle(label, metadata = {}) {
  const parts = [label, metadata.sublabel, metadata.context, metadata.tag, metadata.brand]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '');
  return `<title>${esc(parts.join(' · '))}</title>`;
}

export function focusEdgeAttrs(from, to, label, key, id) {
  const named = label ? ` data-edge-label="${esc(label)}"` : '';
  const keyed = key !== undefined && key !== null ? ` data-edge-key="${esc(String(key))}"` : '';
  const identified = id !== undefined && id !== null && String(id).trim() !== ''
    ? ` data-edge-id="${esc(String(id))}"`
    : '';
  return `data-edge-from="${esc(from)}" data-edge-to="${esc(to)}"${named}${keyed}${identified}`;
}
