import styles from './RingBinder.module.css';

const RING_COUNT = 7;

/**
 * A column of metal rings along the spine.
 *
 * Deliberately NOT a single stretched SVG: this strip's rendered aspect
 * ratio varies a lot across viewports (~28-44px wide, ~480-700px tall),
 * and a shared viewBox stretched via preserveAspectRatio="none" to fill
 * that box would scale X and Y independently - squashing every ring
 * into a thin sliver instead of a recognizable ring. Each ring below is
 * its own element with a fixed aspect-ratio, so it keeps its own correct
 * proportions no matter how tall the strip is; only the spacing between
 * rings (handled by the flex column) responds to the container size.
 *
 * The "hole" is a smaller circle layered on top, colored to match the
 * leather behind it - an approximation (real leather has grain/gradient
 * the flat color can't replicate exactly) but reads correctly as a
 * shadowed recess rather than a flaw.
 */
export default function RingBinder() {
  return (
    <div className={styles.binder} aria-hidden="true">
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <span key={i} className={styles.ring}>
          <span className={styles.ringHole} />
        </span>
      ))}
    </div>
  );
}
