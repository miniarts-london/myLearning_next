'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Collapse from '@mui/material/Collapse';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import type { IndexActivity, IndexSection } from './types';
import styles from '@/css/CourseIndex.module.css';

interface CourseIndexProps {
  courseid: number;
  coursename: string;
  sections: IndexSection[];
}

// Like Moodle's course index: every section, its activities, and what's done.
// A client component so sections can open and close, and the current activity is highlighted.
export function CourseIndex({ courseid, coursename, sections }: CourseIndexProps) {
  const pathname = usePathname();
  // All sections start open; the learner can close the ones they don't need.
  const [closed, setClosed] = useState<Set<number>>(() => new Set());

  const toggle = (id: number) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  return (
    <>
      <Typography component="p" variant="overline" className={styles.heading}>Course index</Typography>
      <Link href={`/courses/${courseid}`} underline="hover"
        aria-current={pathname === `/courses/${courseid}` ? 'page' : undefined}
        className={styles.courseLink}>
        {coursename}
      </Link>
      <List component="div" disablePadding dense>
        {sections.map((section) => {
          const open = !closed.has(section.id);
          const listId = `index-section-${section.id}`;
          return (
            <div key={section.id}>
              <ListItemButton component="button" onClick={() => toggle(section.id)} aria-expanded={open} aria-controls={listId}
                className={styles.sectionButton}>
                <ListItemIcon className={styles.chevronBox}>
                  <ExpandMoreIcon fontSize="small" className={open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron} />
                </ListItemIcon>
                <ListItemText primary={section.name} slotProps={{ primary: { className: styles.sectionName } }} />
              </ListItemButton>
              <Collapse in={open} timeout="auto">
                <List id={listId} disablePadding dense>
                  {section.activities.map((a) => (
                    <IndexItem key={a.id} activity={a} current={a.href !== undefined && pathname === a.href} />
                  ))}
                </List>
              </Collapse>
            </div>
          );
        })}
      </List>
    </>
  );
}

function IndexItem({ activity: a, current }: { activity: IndexActivity; current: boolean }) {
  const status = a.completion === 'done' ? 'Done' : a.completion === 'todo' ? 'To do' : undefined;
  const content = (
    <>
      <ListItemText primary={a.name} slotProps={{ primary: { className: current ? styles.currentName : undefined } }} />
      {a.completion && (
        // The icon is decorative; the status is in the visually hidden text for screen readers.
        <ListItemIcon className={styles.status}>
          {a.completion === 'done'
            ? <CheckCircleIcon fontSize="small" color="success" aria-hidden />
            : <RadioButtonUncheckedIcon fontSize="small" className={styles.todo} aria-hidden />}
          <span className="visually-hidden">{status}</span>
        </ListItemIcon>
      )}
    </>
  );
  // Each activity is an <li>, so screen readers announce the list and how many items it has.
  return (
    <ListItem disablePadding>
      {a.href ? (
        <ListItemButton href={a.href} selected={current} aria-current={current ? 'page' : undefined}
          className={current ? `${styles.item} ${styles.current}` : styles.item}>
          {content}
        </ListItemButton>
      ) : (
        <ListItemButton disabled className={`${styles.item} ${styles.unlinked}`}>{content}</ListItemButton>
      )}
    </ListItem>
  );
}
