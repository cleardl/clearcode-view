// Adapted from tt-a1i/archify; see ../NOTICE.md and sources.json.
import { BRAND_MARKS } from './generated-brand-marks.mjs';
import { esc, textUnits } from './utils.mjs';
const MARK_BY_LOOKUP = new Map(), MARK_BY_DOMAIN = new Map();
function lookupForms(value) {
  const raw = String(value ?? '').trim().toLocaleLowerCase('en-US');
  if (!raw) return [];
  const dashed = raw.replace(/[\s_]+/g, '-');
  const compact = raw.replace(/[\s_.-]+/g, '');
  return [...new Set([raw, dashed, compact])];
}

for (const mark of BRAND_MARKS) {
  for (const value of [mark.id, mark.title, ...mark.aliases]) {
    for (const form of lookupForms(value)) {
      if (!MARK_BY_LOOKUP.has(form)) MARK_BY_LOOKUP.set(form, mark);
    }
  }
  for (const domain of mark.domains) MARK_BY_DOMAIN.set(domain, mark);
}

function asUrl(value) {
  try {
    const url = new URL(String(value));
    return ['https:', 'http:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

// Public provenance is separate from the URL used to reproduce a pinned asset.
export function normalizeBrandSourceUrl(value) {
  const url = asUrl(value);
  if (!url) return null;
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  return url.href;
}

function domainMark(hostname) {
  const host = hostname.toLocaleLowerCase('en-US').replace(/\.$/, '');
  const candidates = [...MARK_BY_DOMAIN.entries()]
    .filter(([domain]) => host === domain || host.endsWith(`.${domain}`))
    .sort(([left], [right]) => right.length - left.length);
  return candidates[0]?.[1] || null;
}

export function findBrandMark(value) {
  const url = asUrl(value);
  if (url) return domainMark(url.hostname);
  for (const form of lookupForms(value)) {
    const mark = MARK_BY_LOOKUP.get(form);
    if (mark) return mark;
  }
  return null;
}


export function brandMarkFor(node) {
  if (!node?.brand) return null;
  if (typeof node.brand !== 'string') throw new Error('Archify browser rendering supports bundled brand IDs only');
  const mark = findBrandMark(node.brand);
  if (!mark) throw new Error('Unknown bundled brand: ' + node.brand);
  return { ...mark, kind: 'preset', status: 'preset', sourceUrl: mark.provenance.source };
}
export function brandMetadataFor(node) {
  const mark = brandMarkFor(node);
  return mark ? {
    brand: mark.title,
    brandId: mark.id,
    brandStatus: mark.status,
    brandSource: mark.sourceUrl,
  } : {};
}

export function brandLabelFitWidth(node, width) {
  return brandMarkFor(node) ? Math.max(1, width - 48) : width;
}

export function brandTopRailProblem(node, width, minimumFontSize, subject = 'Node') {
  if (!brandMarkFor(node)) return null;
  const available = width - 48;
  const required = textUnits(node.label) * minimumFontSize * 0.6;
  if (available >= required) return null;
  return `${subject} "${node.id}" brand top rail leaves ${Math.max(0, available)}px for its label, but `
    + `"${node.label}" needs ~${Math.ceil(required)}px at the ${minimumFontSize}px legible minimum — widen the node or shorten the label.`;
}

function markAttrs(mark) {
  return [
    `data-brand-mark="${esc(mark.id)}"`,
    `data-brand-title="${esc(mark.title)}"`,
    `data-brand-status="${esc(mark.status)}"`,
    mark.sourceUrl ? `data-brand-source="${esc(mark.sourceUrl)}"` : '',
    mark.sha256 ? `data-brand-sha256="${esc(mark.sha256)}"` : '',
  ].filter(Boolean).join(' ');
}

export function renderBrandMark(node, { x, y, size = 16 } = {}) {
  const mark = brandMarkFor(node);
  if (!mark) return '';
  const inset = 3;
  let content;
  if (mark.kind === 'preset') {
    const scale = (size - inset * 2) / mark.viewBox;
    content = `<path d="${esc(mark.path)}" transform="translate(${inset} ${inset}) scale(${scale})" fill="#${esc(mark.hex)}"/>`;
  } else if (mark.kind === 'remote') {
    content = `<image href="${esc(mark.dataUrl)}" x="${inset}" y="${inset}" width="${size - inset * 2}" height="${size - inset * 2}" preserveAspectRatio="xMidYMid meet"/>`;
  } else {
    const scale = size / 20;
    content = `<g transform="scale(${scale})" class="brand-mark-fallback"><circle cx="10" cy="10" r="5.2"/><path d="M4.8 10h10.4M10 4.8c1.6 1.6 2.4 3.3 2.4 5.2s-.8 3.6-2.4 5.2M10 4.8C8.4 6.4 7.6 8.1 7.6 10s.8 3.6 2.4 5.2"/></g>`;
  }
  return `<g aria-hidden="true" ${markAttrs(mark)} class="brand-mark" transform="translate(${x} ${y})">
            <rect width="${size}" height="${size}" rx="4" class="brand-mark-badge"/>
            ${content}
            <rect width="${size}" height="${size}" rx="4" class="brand-mark-frame"/>
          </g>`;
}
