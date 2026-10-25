'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AssistantIcon } from '@/components/assistant/AssistantIcon';
import { setWelcoming, WELCOME_COOKIE } from '@/lib/welcome';
import styles from '@/css/WelcomeIntro.module.css';

// Plays once, right after logging in: "Welcome back, Sam" with the horse trotting in the middle of
// an empty screen (the page is hidden meanwhile: see setWelcoming). Once the page behind has
// finished loading, the greeting fades and the horse gallops off to become the Assistant button;
// when it lands, the page fades in. Click or press any key to skip. Skipped entirely for people who
// prefer reduced motion. Decorative: the page's own heading already says "Welcome back".
const HELLO_MS = 1600;    // The greeting shows for at least this long…
const MAX_WAIT_MS = 8000; // …and at most this long, however slow the page is to load
const FLY_MS = 900;       // The horse's trip to the Assistant button
const FADE_MS = 700;      // The page fading in, once the horse has landed (matches globals.css)

const pageReady = () =>
  Boolean(document.querySelector('main h1')) && !document.querySelector('main [data-loading]');
const fabIcon = () => document.querySelector('[data-assistant-fab-icon]');

// Whether the welcome is due: the cookie set at login. Read in the browser, so a later re-render of
// the page from the server (which Next.js may do right after logging in) can't cut the intro short.
// The cookie is only cleared once the intro has finished.
const isDue = () => document.cookie.split('; ').includes(`${WELCOME_COOKIE}=1`);
const clearDue = () => { document.cookie = `${WELCOME_COOKIE}=; path=/; max-age=0`; };
const noSubscribe = () => () => {};

export function WelcomeIntro({ firstname, withAssistant }: { firstname: string; withAssistant: boolean }) {
  const due = useSyncExternalStore(noSubscribe, isDue, () => false);
  const [phase, setPhase] = useState<'hello' | 'leaving' | 'done'>('hello');
  const horse = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!due) return;
    // Reduced motion: no intro (the CSS keeps the overlay hidden); just mark it as seen.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      clearDue();
      return;
    }
    setWelcoming(true);
    const skip = () => setPhase('done');
    window.addEventListener('keydown', skip, { once: true });

    const started = performance.now();
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    // Wait for the greeting's minimum time, the page's content and the Assistant button (when
    // there is one), so the horse leaves just as there's something to show.
    const check = () => {
      if (cancelled) return;
      const waited = performance.now() - started;
      const ready = pageReady() && (!withAssistant || fabIcon());
      if (waited < HELLO_MS || (!ready && waited < MAX_WAIT_MS)) {
        timer = setTimeout(check, 100);
        return;
      }
      leave();
    };

    const leave = () => {
      setPhase('leaving');
      const from = horse.current?.getBoundingClientRect();
      const to = fabIcon()?.getBoundingClientRect();
      if (horse.current && from && to) {
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + to.height / 2 - (from.top + from.height / 2);
        horse.current.animate(
          [{ transform: 'none' }, { transform: `translate(${dx * 0.5}px, ${dy * 0.35 - 60}px) scale(0.6)`, offset: 0.5 },
            { transform: `translate(${dx}px, ${dy}px) scale(${to.width / from.width})` }],
          { duration: FLY_MS, easing: 'cubic-bezier(0.5, 0, 0.3, 1)', fill: 'forwards' },
        );
      } else {
        horse.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
      }
      // Landed: the page fades in (and the button shows its own horse again), then the intro goes.
      timer = setTimeout(() => {
        setWelcoming(false);
        timer = setTimeout(() => setPhase('done'), FADE_MS);
      }, FLY_MS);
    };

    timer = setTimeout(check, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('keydown', skip);
      setWelcoming(false);
    };
  }, [due, withAssistant]);

  // The horse has landed (or the intro was skipped): show the page and the button's own horse
  // again, and mark the welcome as seen so it doesn't play on the next page.
  useEffect(() => {
    if (phase === 'done') {
      setWelcoming(false);
      clearDue();
    }
  }, [phase]);

  if (!due || phase === 'done') return null;
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
