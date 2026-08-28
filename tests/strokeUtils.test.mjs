import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simplifyStroke, recognizeShape, shapeToPoints } from '../src/components/drawing/strokeUtils.js';

// ---- synthetic stroke generators ------------------------------------------

function makeCircle(cx, cy, r, numPoints = 40) {
  const pts = [];
  for (let i = 0; i <= numPoints; i += 1) {
    const angle = (i / numPoints) * Math.PI * 2;
    pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), pressure: 0.5 });
  }
  return pts;
}

function makeRectangle(x, y, w, h, perSide = 8) {
  const pts = [];
  const corners = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
    [x, y],
  ];
  for (let c = 0; c < corners.length - 1; c += 1) {
    const [x1, y1] = corners[c];
    const [x2, y2] = corners[c + 1];
    for (let i = 0; i < perSide; i += 1) {
      const t = i / perSide;
      pts.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, pressure: 0.5 });
    }
  }
  return pts;
}

function makeLine(x1, y1, x2, y2, numPoints = 20) {
  const pts = [];
  for (let i = 0; i <= numPoints; i += 1) {
    const t = i / numPoints;
    pts.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, pressure: 0.5 });
  }
  return pts;
}

function makeScribble(seed = 1) {
  // Deterministic pseudo-random zigzag - open, non-straight, no
  // recognizable structure. Should never be classified as a shape.
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const pts = [{ x: 0, y: 0, pressure: 0.5 }];
  for (let i = 1; i < 25; i += 1) {
    const prev = pts[i - 1];
    pts.push({
      x: prev.x + (rand() - 0.5) * 40,
      y: prev.y + (rand() - 0.3) * 40,
      pressure: 0.5,
    });
  }
  return pts;
}

// ---- simplifyStroke --------------------------------------------------------

test('simplifyStroke reduces a straight line to its two endpoints', () => {
  const line = makeLine(0, 0, 100, 0, 50); // 51 collinear points
  const simplified = simplifyStroke(line, 1);
  assert.equal(simplified.length, 2);
  assert.deepEqual(simplified[0], line[0]);
  assert.deepEqual(simplified[simplified.length - 1], line[line.length - 1]);
});

test('simplifyStroke preserves shape of a circle within tolerance', () => {
  const circle = makeCircle(50, 50, 30, 60);
  const simplified = simplifyStroke(circle, 1.5);

  assert.ok(simplified.length < circle.length, 'should reduce point count');
  assert.ok(simplified.length > 8, 'should keep enough points to still look round');

  // Every original point should be within tolerance of the simplified path.
  for (const p of circle) {
    let minDist = Infinity;
    for (let i = 0; i < simplified.length - 1; i += 1) {
      const a = simplified[i];
      const b = simplified[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const dist = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
      if (dist < minDist) minDist = dist;
    }
    assert.ok(minDist < 3, `point strayed ${minDist}px from simplified path`);
  }
});

test('simplifyStroke leaves 2-point or shorter strokes untouched', () => {
  assert.deepEqual(simplifyStroke([{ x: 0, y: 0 }], 1), [{ x: 0, y: 0 }]);
  const two = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
  assert.deepEqual(simplifyStroke(two, 1), two);
});

// ---- recognizeShape --------------------------------------------------------

test('recognizeShape identifies a clean circle', () => {
  const result = recognizeShape(makeCircle(100, 100, 40));
  assert.equal(result?.type, 'circle');
});

test('recognizeShape identifies a clean rectangle', () => {
  const result = recognizeShape(makeRectangle(0, 0, 120, 60));
  assert.equal(result?.type, 'rectangle');
});

test('recognizeShape identifies a straight line', () => {
  const result = recognizeShape(makeLine(0, 0, 150, 40));
  assert.equal(result?.type, 'line');
});

test('recognizeShape returns null for a scribble', () => {
  const result = recognizeShape(makeScribble());
  assert.equal(result, null);
});

test('recognizeShape returns null for strokes too small to classify', () => {
  const result = recognizeShape(makeCircle(5, 5, 2, 10));
  assert.equal(result, null);
});

test('recognizeShape returns null for very short point arrays', () => {
  assert.equal(recognizeShape([{ x: 0, y: 0 }, { x: 1, y: 1 }]), null);
});

test('a hand-wobbled circle (small noise) is still recognized', () => {
  const clean = makeCircle(100, 100, 50, 48);
  let s = 7;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const wobbled = clean.map((p) => ({
    x: p.x + (rand() - 0.5) * 3,
    y: p.y + (rand() - 0.5) * 3,
    pressure: p.pressure,
  }));
  assert.equal(recognizeShape(wobbled)?.type, 'circle');
});

// ---- shapeToPoints ---------------------------------------------------------

test('shapeToPoints renders a rectangle as a closed 5-point loop', () => {
  const points = shapeToPoints({ type: 'rectangle', box: { minX: 0, minY: 0, maxX: 10, maxY: 20 } });
  assert.equal(points.length, 5);
  assert.deepEqual([points[0].x, points[0].y], [points[4].x, points[4].y]); // closed loop
});

test('shapeToPoints renders a circle as a smooth closed loop inside its box', () => {
  const box = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  const points = shapeToPoints({ type: 'circle', box });
  assert.ok(points.length > 20);
  for (const p of points) {
    assert.ok(p.x >= -0.01 && p.x <= 100.01);
    assert.ok(p.y >= -0.01 && p.y <= 100.01);
  }
});

test('shapeToPoints renders a line as exactly its two endpoints', () => {
  const points = shapeToPoints({ type: 'line', from: { x: 0, y: 0 }, to: { x: 30, y: 40 } });
  assert.deepEqual(points.map((p) => [p.x, p.y]), [[0, 0], [30, 40]]);
});
