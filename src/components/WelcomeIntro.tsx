'use client';

import { useEffect, useRef, useState } from 'react';
import { AssistantIcon } from '@/components/assistant/AssistantIcon';
import { WELCOME_COOKIE } from '@/lib/welcome';
import styles from '@/css/WelcomeIntro.module.css';

// Plays once, right after logging in: "Welcome back, Sam" with the horse trotting in the middle of
// the screen. Then the horse gallops off to become the Assistant button (bottom right), and the
// page fades in behind it. Click or press any key to skip. Skipped entirely for people who prefer
// reduced motion. Decorative: the page's own heading already says "Welcome back".
const HELLO_MS = 1600; // How long the greeting stays before the horse sets off
const FLY_MS = 900;    // The horse's trip to the Assistant button
const FADE_MS = 700;   // The page fading in (it starts 400ms into the horse's trip)

export function WelcomeIntro({ firstname }: { firstname: string }) {
  const [phase, setPhase] = useState<'hello' | 'leaving' | 'done'>('hello');
  const horse = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.cookie = `${WELCOME_COOKIE}=; path=/; max-age=0`; // Only once
    // Reduced motion: the CSS keeps the overlay hidden; nothing to play.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const skip = () => setPhase('done');
    window.addEventListener('keydown', skip, { once: true });

    const timer = setTimeout(() => {
      setPhase('leaving');
      // Fly to the Assistant button's icon, if there is one (it only shows when the assistant is set up).
      const from = horse.current?.getBoundingClientRect();
      const to = document.querySelector('[data-assistant-fab-icon]')?.getBoundingClientRect();
      if (horse.current && from && to) {
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + to.height / 2 - (from.top + from.height / 2);
        horse.current.animate(
          [{ transform: 'none' }, { transform: `translate(${dx * 0.5}px, ${dy * 0.35 - 60}px) scale(0.6)`, offset: 0.5 },
            { transform: `translate(${dx}px, ${dy}px) scale(${to.width / from.width})`, opacity: 1 }],
          { duration: FLY_MS, easing: 'cubic-bezier(0.5, 0, 0.3, 1)', fill: 'forwards' },
        );
      }
      setTimeout(() => setPhase('done'), Math.max(FLY_MS, 400 + FADE_MS));
    }, HELLO_MS);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', skip);
    };
  }, []);

  if (phase === 'done') return null;
  return (
    <div className={phase === 'leaving' ? `${styles.overlay} ${styles.leaving}` : styles.overlay}
      aria-hidden onClick={() => setPhase('done')}
      style={{ '--fade': `${FADE_MS}ms` } as React.CSSProperties}>
      <div className={styles.horse} ref={horse}>
        <AssistantIcon motion="busy" className={styles.icon} />
      </div>
      <p className={styles.hello}>Welcome back, {firstname}</p>
    </div>
  );
}
