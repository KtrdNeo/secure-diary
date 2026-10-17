import { useLayoutEffect, useRef, useState } from 'react';
import { ringCount, ringDiameter } from '../../features/rings.js';
import styles from './RingBinder.module.css';

/**
 * A column of round metal binder rings along the spine.
 *
 * Every ring is a true circle (width === height === --ring-d); the column
 * measures itself and picks the ring DIAMETER from its width and the ring
 * COUNT from its height, so nothing ever stretches or touches at any size.
 */
export default function RingBinder() {
  const ref = useRef(null);
  const [{ d, n }, setSize] = useState({ d: 28, n: 6 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const diameter = ringDiameter(width);
      setSize((prev) => {
        const next = { d: diameter, n: ringCount(height, diameter) };
        return prev.d === next.d && prev.n === next.n ? prev : next;
      });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className={styles.binder} style={{ '--ring-d': `${d}px` }} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={styles.ring}>
          <span className={styles.ringHole} />
        </span>
      ))}
    </div>
  );
}
