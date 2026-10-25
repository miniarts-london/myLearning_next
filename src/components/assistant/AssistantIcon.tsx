'use client';

import { useId } from 'react';
import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';
import styles from '@/css/AssistantIcon.module.css';

// The assistant's icon: a horse's head in side view. Drawn in currentColor, so it takes the
// colour of whatever it sits in. The eye, nostril and mane line are cut out with a mask, so the
// button's colour shows through them.
//
// motion: "idle" blinks now and then and gives a little nod; "busy" (while the assistant is
// working) nods along at a trot. Both stop for people who prefer reduced motion.
export function AssistantIcon({ motion = 'none', className, ...props }: SvgIconProps & { motion?: 'idle' | 'busy' | 'none' }) {
  const mask = `assistant-icon-${useId().replace(/:/g, '')}`; // Unique per icon on the page
  const motionClass = motion === 'idle' ? styles.idle : motion === 'busy' ? styles.busy : '';
  return (
    <SvgIcon viewBox="0 0 24 24" className={[styles.icon, motionClass, className].filter(Boolean).join(' ')} {...props}>
      <defs>
        <mask id={mask}>
          <rect width="24" height="24" fill="#fff" />
          <circle className={styles.eye} cx="12.2" cy="9.3" r="1.05" fill="#000" />
          <ellipse cx="5.6" cy="15.6" rx=".75" ry=".6" fill="#000" />       {/* Nostril */}
          <path d="M15.4 6.2c1.6 1.4 2.5 3.5 2.8 6.3" stroke="#000" strokeWidth=".9" strokeLinecap="round" fill="none" /> {/* Mane */}
        </mask>
      </defs>
      {/* Ears, forehead, muzzle and neck, facing left. The group is what nods. */}
      <g className={styles.head}>
        <path mask={`url(#${mask})`}
          d="M12.6 2.4l1.9 2.5c3.1.6 5.4 3.1 5.9 6.5l1.1 9.3h-7.2l-.9-4.3c-.7-.5-1.5-.7-2.4-.7H8.6c-.9 1.3-2.3 2-3.8 2-1.5 0-2.6-1-2.6-2.4 0-.9.4-1.7 1.1-2.4l4.7-5.1c.6-.6 1-1.4 1.3-2.1l.7-1.6.7-2.4 1.3 1.4.6-1.7Z" />
      </g>
    </SvgIcon>
  );
}
