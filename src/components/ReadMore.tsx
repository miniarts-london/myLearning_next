'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Button from '@mui/material/Button';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import styles from '@/css/ReadMore.module.css';

// Shows the first three lines of its content, with "Show more" to open the rest, like an
// accordion. The button only appears when there is more to show.
export function ReadMore({ children, label }: { children: React.ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  // Is anything cut off? Checked again whenever the width changes (and with it, the line count).
  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open]);

  return (
    <div className={styles.readMore}>
      <div id={id} ref={ref} className={open ? styles.content : `${styles.content} ${styles.clamped}`}>
        {children}
      </div>
      {(overflows || open) && (
        <Button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id} color="secondary" size="small"
          endIcon={<ExpandMoreIcon className={open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron} />}
          className={styles.toggle}>
          {open ? 'Show less' : 'Show more'}<span className="visually-hidden"> about {label}</span>
        </Button>
      )}
    </div>
  );
}
