'use client';

import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import styles from '@/css/CircularProgressWithLabel.module.css';

interface Props {
  value: number;     // 0–100
  label: string;     // What it measures, for screen readers, e.g. "Course progress"
  size?: number;     // Width and height in pixels
  thickness?: number;
  duration?: number; // How long the fill animation takes, in milliseconds
  color?: RingColor; // A theme palette colour for the ring
}

export type RingColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error';

// The same easing as the ring's in the CSS, cubic-bezier(0.33, 1, 0.68, 1), so they move together.
const easeOut = (t: number) => 1 - (1 - t) ** 3;

// Counts the number shown in the middle up to `target`: from 0 the first time, and from the
// current number when the value changes later (e.g. after Mark as done).
function useCountUp(target: number, duration: number) {
  const [shown, setShown] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const from = current.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = reduceMotion ? 1 : Math.min(1, (now - start) / duration);
      current.current = Math.round(from + (target - from) * easeOut(t));
      setShown(current.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return shown;
}

// A ring that fills as progress goes up, with the percentage in the middle. On first show the
// ring fills from empty and the number counts up with it.
export function CircularProgressWithLabel({ value, label, size = 150, thickness = 4, duration = 1000, color = 'info' }: Props) {
  const rounded = Math.round(Math.min(100, Math.max(0, value)));
  const shown = useCountUp(rounded, duration);

  // MUI draws the ring as a circle 44 units across; this is its full outline length. The CSS
  // starts the animation there ("nothing drawn yet"). These values reach the CSS as variables.
  const circumference = 2 * Math.PI * ((44 - thickness) / 2);
  const vars = {
    '--ring-size': `${size}px`,
    '--ring-circumference': `${circumference}px`,
    '--ring-duration': `${duration}ms`,
  } as React.CSSProperties;

  return (
    <Box className={styles.ring} style={vars}>
      {/* The track: decorative, so hidden from screen readers. */}
      <CircularProgress variant="determinate" value={100} size={size} thickness={thickness} aria-hidden className={styles.track} />
      {/* The value. It always carries the real number (aria-valuenow), so screen readers never hear
          the animation: only the drawing is animated, by CSS. */}
      <CircularProgress variant="determinate" value={rounded} size={size} thickness={thickness} color={color} aria-label={label}
        className={styles.value} />
      {/* The number in the middle. Hidden from screen readers: the progress bar already announces it. */}
      <Box aria-hidden className={styles.center}>
        <Typography component="span" className={styles.number}>{shown}%</Typography>
        <Typography component="span" variant="caption" className={size < 120 ? `${styles.caption} ${styles.captionSmall}` : styles.caption}>complete</Typography>
      </Box>
    </Box>
  );
}
