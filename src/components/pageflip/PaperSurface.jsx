import styles from './PaperSurface.module.css';

/**
 * A single paper page. Texture is procedural (grain via feTurbulence,
 * same rationale as LeatherCover). The corner "peel" in the bottom-right
 * is the app's signature interaction - it lifts on hover/focus and
 * completes a page-turn on click, so navigating the diary itself feels
 * tactile rather than being a plain "Next" button bolted onto flat UI.
 *
 * `interactive=false` is used for the copy of a page rendered inside the
 * mid-flip animation layer, where corner controls would be confusing.
 *
 * `fill=true` is for content that manages its own padding and internal
 * scrolling (EntryEditor: title input + toolbar + prose all have their
 * own padding, and the prose area has its own scroll region) - the
 * default padded/scrollable `.content` box would double up on both.
 */
export default function PaperSurface({
  children,
  onNextCorner,
  onPrevCorner,
  showNext = false,
  showPrev = false,
  interactive = true,
  fill = false,
}) {
  return (
    <div className={styles.paper}>
      <div className={fill ? styles.contentFill : styles.content}>{children}</div>

      {interactive && showPrev && (
        <button
          type="button"
          className={`${styles.corner} ${styles.cornerLeft}`}
          onClick={onPrevCorner}
          aria-label="Previous page"
        />
      )}

      {interactive && showNext && (
        <button
          type="button"
          className={`${styles.corner} ${styles.cornerRight}`}
          onClick={onNextCorner}
          aria-label="Next page"
        />
      )}
    </div>
  );
}
