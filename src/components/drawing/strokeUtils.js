/**
 * src/components/drawing/strokeUtils.js
 *
 * Pure geometry - no canvas, no DOM - so this is fully unit-testable in
 * plain Node (see tests/strokeUtils.test.mjs), unlike almost everything
 * else in the drawing engine which needs a real browser.
 */

/** Perpendicular distance from point p to the line through a-b. */
function distanceToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + clampedT * dx), p.y - (a.y + clampedT * dy));
}

/**
 * Douglas-Peucker simplification. Reduces point count (satisfying the
 * "vector stroke simplification" free-tier storage requirement) while
 * keeping the points that actually define the stroke's shape. Operates
 * on x/y only; any extra fields on each point (e.g. pressure) ride along
 * unchanged on whichever points survive.
 *
 * @param {Array<{x:number, y:number}>} points
 * @param {number} tolerance - px; higher = more aggressive simplification
 */
export function simplifyStroke(points, tolerance = 2) {
  if (points.length <= 2) return points;

  const first = points[0];
  const last = points[points.length - 1];
  let maxDist = 0;
  let maxIndex = 0;

  for (let i = 1; i < points.length - 1; i += 1) {
    const dist = distanceToSegment(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyStroke(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyStroke(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

function getBoundingBox(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i += 1) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

/** Shoelace formula - polygon area from a closed point loop. */
function shoelaceArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/**
 * Heuristic shape recognition - deliberately simple (bounding-box math,
 * not ML/gesture-matching). Good enough to catch a clearly-intentional
 * circle/rectangle/line and returns null for anything ambiguous, which
 * is the right failure mode: leaving ambiguous ink as freeform is much
 * less annoying than confidently snapping the wrong shape.
 *
 * @returns {null | {type:'line', from, to} | {type:'circle', box} | {type:'rectangle', box}}
 */
export function recognizeShape(points) {
  if (points.length < 6) return null;

  const box = getBoundingBox(points);
  const diag = Math.hypot(box.width, box.height);
  if (diag < 12) return null; // too small to classify meaningfully

  const first = points[0];
  const last = points[points.length - 1];
  const closureDist = Math.hypot(last.x - first.x, last.y - first.y);
  const isClosed = closureDist < diag * 0.15;
  const length = pathLength(points);

  if (!isClosed) {
    // "Straightness": ratio of direct point-to-point distance over the
    // actual path length. 1.0 = perfectly straight; a wobbly scribble
    // is well below that.
    const straightness = closureDist / (length || 1);
    if (straightness > 0.92 && length > 20) {
      return { type: 'line', from: first, to: last };
    }
    return null;
  }

  const boxArea = box.width * box.height;
  const fillRatio = boxArea > 0 ? shoelaceArea(points) / boxArea : 0;
  const aspect = box.width / (box.height || 1);

  // A rectangle traced along its own bounds fills close to 100% of the
  // bounding box; any ellipse inscribed in its bounding box fills ~78.5%
  // (pi/4) regardless of aspect ratio - these thresholds split the
  // difference around hand-drawn imprecision, not exact geometry.
  if (fillRatio > 0.88) {
    return { type: 'rectangle', box };
  }
  if (fillRatio > 0.6 && aspect > 0.5 && aspect < 2) {
    return { type: 'circle', box };
  }
  return null;
}

/**
 * Converts a recognizeShape() result back into a clean point array -
 * used to replace the wobbly hand-drawn stroke with the "snapped" shape.
 */
export function shapeToPoints(shape) {
  const PRESSURE = 0.6;
  if (shape.type === 'line') {
    return [
      { x: shape.from.x, y: shape.from.y, pressure: PRESSURE },
      { x: shape.to.x, y: shape.to.y, pressure: PRESSURE },
    ];
  }
  if (shape.type === 'rectangle') {
    const { minX, minY, maxX, maxY } = shape.box;
    return [
      { x: minX, y: minY, pressure: PRESSURE },
      { x: maxX, y: minY, pressure: PRESSURE },
      { x: maxX, y: maxY, pressure: PRESSURE },
      { x: minX, y: maxY, pressure: PRESSURE },
      { x: minX, y: minY, pressure: PRESSURE },
    ];
  }
  if (shape.type === 'circle') {
    const { minX, minY, maxX, maxY } = shape.box;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const rx = (maxX - minX) / 2;
    const ry = (maxY - minY) / 2;
    const points = [];
    const segments = 48;
    for (let i = 0; i <= segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      points.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle), pressure: PRESSURE });
    }
    return points;
  }
  return [];
}
