/**
 * src/components/drawing/renderStrokes.js
 *
 * Canvas2D rendering only - kept separate from strokeUtils.js (which is
 * pure geometry, DOM-free, and unit-tested) since this touches the
 * Canvas2D API and can only really be verified by looking at it. Shared
 * by DrawingCanvas (live drawing) and DrawingBlock (read-only thumbnail
 * replay) so a saved drawing always looks exactly like it did when drawn.
 */

/**
 * Two-pass stroke: a soft, wide, low-alpha "bleed" pass underneath a
 * crisp, pressure-width core pass on top - simulating ink absorbing
 * slightly into paper fiber rather than sitting as a hard vector line.
 */
function drawStroke(ctx, points, inkColor) {
  if (points.length === 0) return;

  if (points.length === 1) {
    const p = points[0];
    ctx.fillStyle = inkColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1 + p.pressure * 2.5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = inkColor;

  ctx.globalAlpha = 0.16;
  drawVariableWidthPath(ctx, points, (pressure) => 2.5 + pressure * 6);

  ctx.globalAlpha = 1;
  drawVariableWidthPath(ctx, points, (pressure) => 1 + pressure * 3.25);
}

function drawVariableWidthPath(ctx, points, widthFromPressure) {
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    ctx.lineWidth = widthFromPressure((a.pressure + b.pressure) / 2);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{points: Array<{x,y,pressure}>, color: string}>} strokes
 * @param {{clear?: boolean, widthCss?: number, heightCss?: number}} [opts]
 */
export function renderStrokes(ctx, strokes, opts = {}) {
  const { clear = true, widthCss, heightCss } = opts;
  if (clear) {
    const w = widthCss ?? ctx.canvas.width;
    const h = heightCss ?? ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);
  }
  ctx.globalAlpha = 1;
  for (const stroke of strokes) {
    drawStroke(ctx, stroke.points, stroke.color);
  }
}

/**
 * Sizes a canvas element for crisp rendering at the display's actual
 * pixel density, while keeping drawing coordinates in CSS pixels (so
 * stroke point data stays resolution-independent).
 */
export function fitCanvasToContainer(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const targetW = Math.max(1, Math.round(rect.width * dpr));
  const targetH = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, widthCss: rect.width, heightCss: rect.height };
}
