'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Collapse from '@mui/material/Collapse';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import type { IndexActivity, IndexSection } from './types';

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
      <Typography component="p" variant="overline" sx={{ color: 'text.secondary', px: 2, pt: 2 }}>Course index</Typography>
      <Link href={`/courses/${courseid}`} underline="hover"
        aria-current={pathname === `/courses/${courseid}` ? 'page' : undefined}
        sx={{ display: 'block', px: 2, pb: 1.5, fontWeight: 600, color: 'text.primary' }}>
        {coursename}
      </Link>
      <List component="div" disablePadding dense>
        {sections.map((section) => {
          const open = !closed.has(section.id);
          const listId = `index-section-${section.id}`;
          return (
            <div key={section.id}>
              <ListItemButton component="button" onClick={() => toggle(section.id)} aria-expanded={open} aria-controls={listId}
                sx={{ px: 1, py: 0.75, width: '100%', textAlign: 'left', font: 'inherit' }}>
                <ListItemIcon sx={{ minWidth: 28, color: 'text.secondary' }}>
                  {/* One chevron that turns as the section opens and closes. */}
                  <ExpandMoreIcon fontSize="small"
                    sx={(theme) => ({
                      transform: open ? 'rotate(180deg)' : 'none',
                      transition: theme.transitions.create('transform', { duration: theme.transitions.duration.shorter }),
                    })} />
                </ListItemIcon>
                <ListItemText primary={section.name} slotProps={{ primary: { sx: { fontWeight: 600 } } }} />
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
      <ListItemText primary={a.name} slotProps={{ primary: { sx: { fontWeight: current ? 600 : 400 } } }} />
      {a.completion && (
        // The icon is decorative; the status is in the visually hidden text for screen readers.
        <ListItemIcon sx={{ minWidth: 0, ml: 1 }}>
          {a.completion === 'done'
            ? <CheckCircleIcon fontSize="small" color="success" aria-hidden />
            : <RadioButtonUncheckedIcon fontSize="small" sx={{ color: 'text.disabled' }} aria-hidden />}
          <span className="visually-hidden">{status}</span>
        </ListItemIcon>
      )}
    </>
  );
  const indent = { pl: 4.5, pr: 1.5, py: 0.5 };

  return a.href ? (
    <ListItemButton href={a.href} selected={current} aria-current={current ? 'page' : undefined}
      sx={{ ...indent, borderLeft: 4, borderColor: current ? 'primary.main' : 'transparent' }}>
      {content}
    </ListItemButton>
  ) : (
    <ListItemButton disabled sx={{ ...indent, opacity: '1 !important' }}>{content}</ListItemButton>
  );
}
