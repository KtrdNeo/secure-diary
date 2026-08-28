import styles from './LeatherCover.module.css';

/**
 * The outer leather frame. Texture is 100% procedural CSS/SVG (fractal-
 * noise grain via feTurbulence + gradients for sheen/vignette) - no
 * photographic assets, so nothing here is sourced from anyone else's
 * artwork.
 */
export default function LeatherCover({ children }) {
  return (
    <div className={styles.cover}>
      <div className={styles.stitching} aria-hidden="true" />
      {children}
    </div>
  );
}
