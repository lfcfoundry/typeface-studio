function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

export function contourPathData(contour) {
  let path = `M ${contour.start.x} ${contour.start.y}`;
  for (const segment of contour.segments) {
    if (segment.type === 'line') path += ` L ${segment.to.x} ${segment.to.y}`;
    else path += ` Q ${segment.control.x} ${segment.control.y} ${segment.to.x} ${segment.to.y}`;
  }
  return `${path} Z`;
}

export function glyphSvg(glyph, large = false) {
  const bounds = glyph.bounds;
  const padding = large ? 36 : 16;
  const width = Math.max(1, bounds.xMax - bounds.xMin), height = Math.max(1, bounds.yMax - bounds.yMin);
  const paths = glyph.contours.map(contour =>
    `<path d="${contourPathData(contour)}" fill-rule="nonzero" data-contour-id="${escapeHtml(contour.id)}" data-role="${escapeHtml(contour.role)}"/>`
  ).join('');
  return `<svg viewBox="${bounds.xMin - padding} ${-bounds.yMax - padding} ${width + 2 * padding} ${height + 2 * padding}" role="img" aria-label="${escapeHtml(glyph.character)} contour"><g transform="scale(1,-1)" fill="currentColor">${paths}</g></svg>`;
}
