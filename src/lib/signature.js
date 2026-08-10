// Renders the vector stroke data captured by public/js/signature.js into an
// inline SVG. Because signatures are stored as point coordinates rather than
// a raster image, they render crisply at any size, both on the review page
// and inside the final locked document, without needing an image codec.
function strokesToSvg(rawJson, { width = 220, height = 66 } = {}) {
  if (!rawJson) return '';
  let data;
  try {
    data = JSON.parse(rawJson);
  } catch {
    return '';
  }
  if (!data || !Array.isArray(data.strokes) || data.strokes.length === 0) return '';

  const paths = data.strokes
    .filter((s) => Array.isArray(s) && s.length > 0)
    .map((stroke) => {
      const d = stroke
        .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
        .join(' ');
      return `<path d="${d}" fill="none" stroke="#1f2933" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${data.w} ${data.h}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ลายมือชื่อ">${paths}</svg>`;
}

module.exports = { strokesToSvg };
