import { useRef, useState, useCallback, useEffect } from 'react';
import { simplifyStroke, recognizeShape, shapeToPoints } from './strokeUtils.js';
import { renderStrokes, fitCanvasToContainer } from './renderStrokes.js';
import styles from './DrawingCanvas.module.css';

const SIMPLIFY_TOLERANCE = 1.5;
const PEN_COLORS = [
  { id: 'ink', label: 'Ink', value: '#2b2b2b' },
  { id: 'blue', label: 'Blue', value: '#2f4d8f' },
  { id: 'red', label: 'Red', value: '#9b2b2b' },
];

/**
 * Full-panel drawing surface. Strokes are kept as vector point arrays
 * (never rasterized until the very end, and even then only as a replay -
 * see renderStrokes.js) so they stay small enough to store as JSON
 * through the normal encryptData() path rather than needing the binary
 * path reserved for audio.
 */
export default function DrawingCanvas({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const sizingRef = useRef({ ctx: null, widthCss: 0, heightCss: 0 });
  const currentStrokeRef = useRef(null);
  const [strokes, setStrokes] = useState([]);
  const [, bumpFrame] = useState(0);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [colorId, setColorId] = useState('ink');

  const redraw = useCallback(() => {
    const { ctx, widthCss, heightCss } = sizingRef.current;
    if (!ctx) return;
    const allStrokes = currentStrokeRef.current ? [...strokes, currentStrokeRef.current] : strokes;
    renderStrokes(ctx, allStrokes, { widthCss, heightCss });
  }, [strokes]);

  // (Re)size the canvas to its container, at real device pixel density.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const resize = () => {
      sizingRef.current = fitCanvasToContainer(canvas);
      redraw();
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    redraw();
  }, [redraw]);

  function getPoint(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      // Mice and many touchscreens report pressure as 0 rather than a
      // real value - treat that as a normal mid-weight stroke instead
      // of an invisible one.
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  }

  function handlePointerDown(e) {
    canvasRef.current.setPointerCapture(e.pointerId);
    const color = PEN_COLORS.find((c) => c.id === colorId).value;
    currentStrokeRef.current = { points: [getPoint(e)], color };
    bumpFrame((n) => n + 1);
  }

  function handlePointerMove(e) {
    if (!currentStrokeRef.current) return;
    currentStrokeRef.current.points.push(getPoint(e));
    redraw();
  }

  function commitCurrentStroke() {
    const finished = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (!finished || finished.points.length === 0) return;

    let points = simplifyStroke(finished.points, SIMPLIFY_TOLERANCE);
    let recognized;
    if (snapEnabled) {
      const shape = recognizeShape(finished.points);
      if (shape) {
        points = shapeToPoints(shape);
        recognized = shape.type;
      }
    }
    setStrokes((prev) => [...prev, { points, color: finished.color, recognized }]);
  }

  function handleUndo() {
    setStrokes((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    setStrokes([]);
  }

  function handleDone() {
    if (strokes.length === 0) {
      onCancel();
      return;
    }
    onSave(strokes);
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <div className={styles.colors}>
            {PEN_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-label={`${c.label} pen`}
                aria-pressed={colorId === c.id}
                className={styles.colorSwatch}
                style={{ '--swatch-color': c.value }}
                onClick={() => setColorId(c.id)}
              />
            ))}
          </div>

          <label className={styles.snapToggle}>
            <input
              type="checkbox"
              checked={snapEnabled}
              onChange={(e) => setSnapEnabled(e.target.checked)}
            />
            Snap shapes
          </label>

          <div className={styles.spacer} />

          <button type="button" className={styles.toolButton} onClick={handleUndo} disabled={strokes.length === 0}>
            Undo
          </button>
          <button type="button" className={styles.toolButton} onClick={handleClear} disabled={strokes.length === 0}>
            Clear
          </button>
          <button type="button" className={styles.toolButton} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={styles.doneButton} onClick={handleDone}>
            Done
          </button>
        </div>

        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={commitCurrentStroke}
          onPointerCancel={commitCurrentStroke}
          onPointerLeave={(e) => {
            // A pointer that leaves the canvas mid-stroke without an
            // up/cancel event (happens with some trackpads/tablets)
            // would otherwise leave a stroke permanently "stuck" open.
            if (e.buttons === 0 && currentStrokeRef.current) commitCurrentStroke();
          }}
        />
      </div>
    </div>
  );
}
