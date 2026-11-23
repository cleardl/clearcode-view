/** Keep browser-owned sequence support reproducible when refreshing the pinned upstream renderer. */
export function patchSequenceRenderer(source) {
  function replace(pattern, replacement) {
    if (!source.match(pattern)) throw new Error('Archify sequence patch no longer matches its upstream source: ' + pattern);
    source = source.replace(pattern, replacement);
  }

  replace(/function messageGeometry\(message\) \{[\s\S]*?\n\}\n\nfunction messageLabelBox/, `function messageGeometry(message) {
  const from = participants.get(message.from), to = participants.get(message.to);
  if (!from || !to || typeof message.y !== 'number') return null;
  const self = message.from === message.to;
  const direction = self ? (from.index === participantCount - 1 && participantCount > 1 ? -1 : 1) : (to.cx > from.cx ? 1 : -1);
  const start = from.cx + direction * 7, end = self ? start : to.cx - direction * 7;
  const turn = start + direction * 42;
  const points = self ? [[start, message.y], [turn, message.y], [turn, message.y + 24], [end, message.y + 24]] : [[start, message.y], [end, message.y]];
  return { start, end, self, points, center: self ? start + direction * 21 : (start + end) / 2 };
}

function messageLabelBox`);
  replace('x: geometry.center - width / 2,', 'x: geometry.self ? Math.max(16, Math.min(geometry.center - width / 2, viewBox[0] - width - 16)) : geometry.center - width / 2,');
  replace(/function messageRouteBox\(message\) \{[\s\S]*?\n\}/, `function messageRouteBox(message) {
  const geometry = messageGeometry(message);
  if (!geometry) return null;
  const xs = geometry.points.map(point => point[0]);
  return { x: Math.min(...xs), y: message.y - 2, width: Math.max(...xs) - Math.min(...xs), height: geometry.self ? 28 : 4 };
}`);
  replace(/function messagePath\(message\) \{[\s\S]*?\n\}/, `function messagePath(message) {
  const geometry = messageGeometry(message);
  return { points: !geometry ? [] : geometry.self ? geometry.points : [[participants.get(message.from).cx, message.y], [participants.get(message.to).cx, message.y]] };
}`);
  replace(/      if \(message.from === message.to\) \{\n        const problem =[\s\S]*?\n      \} else \{/, '      if (message.from !== message.to) {');
  replace(': message.y + 6)),', ': message.y + (message.from === message.to ? 30 : 6))),');
  replace('message.y + 18 + 65));', 'message.y + (message.from === message.to ? 24 : 0) + 18 + 65));');
  replace("  const { start, end } = messageGeometry(message);", "  const { start, end, points } = messageGeometry(message);\n  const route = points.map(([x, y], index) => (index ? 'L ' : 'M ') + x + ' ' + y).join(' ');");
  replace('routePointsValue([[start, message.y], [end, message.y]])', 'routePointsValue(points)');
  replace('d="M ${start} ${message.y} L ${end} ${message.y}"', 'd="${route}"');

  replace('  const toIndex = participantIndexById.get(message.to);\n  if (message.note', `  const toIndex = participantIndexById.get(message.to);
  if (message.note && typeof message.y === 'number' && fromIndex !== undefined && fromIndex === toIndex) {
    const maxWidth = Math.min(220, canvasWidth - 48);
    const lines = wrapNoteText(message.note, maxWidth);
    const x = Math.max(24, Math.min(participantX(fromIndex) + 20, canvasWidth - maxWidth - 24));
    const baseline = message.y + 42;
    result = { x, baseline, lines, width: Math.max(...lines.map(noteTextWidth)), top: baseline - NOTE_FONT_SIZE * 1.2, bottom: baseline + 4 + (lines.length - 1) * NOTE_LINE_HEIGHT };
    noteLayouts.set(message, result);
    return result;
  }
  if (message.note`);
  return source;
}
