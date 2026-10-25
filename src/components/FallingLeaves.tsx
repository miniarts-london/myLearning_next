import styles from '@/css/FallingLeaves.module.css';

// Autumn leaves drifting down behind the login card. Purely decorative (hidden from screen
// readers), drawn with CSS animations, and switched off for people who prefer reduced motion.
// Each leaf's position, size, colour, speed (seconds to fall the whole screen) and delay are fixed
// here (not random), so the server and the browser draw exactly the same thing. They fall slowly.
const LEAVES = [
  { x: 4, size: 26, colour: '#c8553d', duration: 28, delay: -4, sway: 40 },
  { x: 12, size: 18, colour: '#e09f3e', duration: 36, delay: -18, sway: -30 },
  { x: 21, size: 22, colour: '#9e2a2b', duration: 32, delay: -10, sway: 50 },
  { x: 30, size: 16, colour: '#d68c45', duration: 40, delay: -26, sway: -45 },
  { x: 38, size: 24, colour: '#bc6c25', duration: 30, delay: -2, sway: 35 },
  { x: 47, size: 20, colour: '#e09f3e', duration: 38, delay: -22, sway: -40 },
  { x: 55, size: 28, colour: '#c8553d', duration: 34, delay: -14, sway: 55 },
  { x: 63, size: 17, colour: '#9e2a2b', duration: 42, delay: -30, sway: -35 },
  { x: 71, size: 23, colour: '#dda15e', duration: 32, delay: -8, sway: 45 },
  { x: 79, size: 19, colour: '#bc6c25', duration: 36, delay: -20, sway: -50 },
  { x: 87, size: 25, colour: '#c8553d', duration: 30, delay: -12, sway: 30 },
  { x: 95, size: 18, colour: '#e09f3e', duration: 40, delay: -28, sway: -40 },
];

export function FallingLeaves() {
  return (
    // falling-leaves: a plain class name too, so a page can restyle them (e.g. in black and white).
    <div className={`${styles.leaves} falling-leaves`} aria-hidden>
      {LEAVES.map((leaf, i) => (
        <span key={i} className={styles.leaf}
          style={{
            '--x': `${leaf.x}vw`, '--size': `${leaf.size}px`, '--duration': `${leaf.duration}s`,
            '--delay': `${leaf.delay}s`, '--sway': `${leaf.sway}px`, color: leaf.colour,
          } as React.CSSProperties}>
          {/* A simple leaf: an almond shape with a central vein and a short stem. */}
          <svg viewBox="0 0 24 24" className={styles.shape}>
            <path fill="currentColor" d="M12 2C6.5 6 4 10.5 4.6 15c.5 3.6 3.4 6 7.4 6s6.9-2.4 7.4-6C20 10.5 17.5 6 12 2Z" />
            <path d="M12 6v17" stroke="rgba(0,0,0,.25)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          </svg>
        </span>
      ))}
    </div>
  );
}
