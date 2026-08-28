import { useState, useEffect, useRef } from 'react';
import PaperSurface from './PaperSurface.jsx';
import styles from './PageFlipBook.module.css';

/**
 * Orchestrates turning between `pages` (an array of React nodes) using a
 * two-layer 3D flip: a static layer (the page that ends up visible at
 * rest) and a flip layer (the page that's mid-motion), rotated on the Y
 * axis and hidden via backface-visibility once it's edge-on.
 *
 * The two directions are NOT mirror images of the same animation - they
 * use different layers for the "moving" page:
 *
 *  - forward: the static layer is updated to the DESTINATION immediately
 *    (no visible change yet, since the flip layer fully covers it). The
 *    flip layer holds the SOURCE page and rotates 0deg -> -180deg,
 *    uncovering the destination as it passes 90deg.
 *  - backward: the static layer stays on the SOURCE page until the
 *    animation completes. The flip layer holds the DESTINATION page and
 *    rotates -180deg -> 0deg, arriving on top of the (still-source)
 *    static layer.
 *
 * Only `transform` is animated, so this stays on the compositor thread
 * (GPU-accelerated, capable of 60fps) rather than triggering layout.
 */
export default function PageFlipBook({ pages, fill = false, jumpToIndex = null, onJumpComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flip, setFlip] = useState(null); // { direction, otherIndex, animate } | null
  const raf2Ref = useRef(null);

  const goNext = () => {
    if (flip || currentIndex >= pages.length - 1) return;
    const source = currentIndex;
    setCurrentIndex(source + 1);
    setFlip({ direction: 'forward', otherIndex: source, animate: false });
  };

  const goPrev = () => {
    if (flip || currentIndex <= 0) return;
    setFlip({ direction: 'backward', otherIndex: currentIndex - 1, animate: false });
  };

  // External navigation (search result clicked, etc.) - an instant cut
  // rather than animating through however many intermediate pages sit
  // between "here" and "there", which would just be a long wait dressed
  // up as a page-flip.
  useEffect(() => {
    if (jumpToIndex == null) return;
    if (jumpToIndex >= 0 && jumpToIndex < pages.length && jumpToIndex !== currentIndex) {
      setFlip(null);
      setCurrentIndex(jumpToIndex);
    }
    onJumpComplete?.();
    // Only jumpToIndex should trigger this - pages.length/currentIndex
    // are read, not watched, or clicking the same result twice (or any
    // unrelated page turn) would re-trigger a jump.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToIndex]);

  // Mount the flip layer at its start angle first, then flip `animate` on
  // a subsequent frame - otherwise the browser can coalesce the initial
  // state and the transition target into one paint and skip the animation.
  useEffect(() => {
    if (flip && !flip.animate) {
      // Single rAF can still land before the browser paints the start
      // angle in some browsers; nesting two makes the "paint the 0/-179
      // starting frame, THEN animate" order reliable.
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => {
          setFlip((f) => (f ? { ...f, animate: true } : f));
        });
        raf2Ref.current = raf2;
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2Ref.current) cancelAnimationFrame(raf2Ref.current);
      };
    }
    return undefined;
  }, [flip]);

  const handleFlipTransitionEnd = (e) => {
    if (e.target !== e.currentTarget) return; // ignore bubbled child transitions
    if (!flip) return;
    if (flip.direction === 'backward') {
      setCurrentIndex(flip.otherIndex);
    }
    setFlip(null);
  };

  const rotation = !flip ? 0 : flip.direction === 'forward'
    ? (flip.animate ? -179 : 0)
    : (flip.animate ? 0 : -179);

  return (
    <div className={styles.perspective}>
      <div className={styles.staticLayer}>
        <PaperSurface
          onNextCorner={goNext}
          onPrevCorner={goPrev}
          showNext={currentIndex < pages.length - 1}
          showPrev={currentIndex > 0}
          fill={fill}
        >
          {pages[currentIndex]}
        </PaperSurface>
      </div>

      {flip && (
        <div
          className={styles.flipLayer}
          style={{ transform: `rotateY(${rotation}deg)` }}
          onTransitionEnd={handleFlipTransitionEnd}
        >
          <PaperSurface interactive={false} fill={fill}>
            {pages[flip.otherIndex]}
          </PaperSurface>
        </div>
      )}

      <div className={styles.pageIndicator} aria-live="polite">
        {currentIndex + 1} / {pages.length}
      </div>
    </div>
  );
}
