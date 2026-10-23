'use client';

import { useState, useSyncExternalStore } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import styles from '@/css/CourseShell.module.css';

const INDEX_ID = 'course-index';
// The index's width and opening speed are in src/css/CourseShell.module.css.

// Whether the index is open on wide screens is remembered in this browser (like Moodle).
// useSyncExternalStore reads it without a hydration mismatch: the server always renders it open.
const STORAGE_KEY = 'mylearning:course-index-open';
const listeners = new Set<() => void>();
function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}
function writeOpen(open: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(open));
  } catch {
    // Private browsing etc.: it just won't be remembered.
  }
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Lays out a course page with the course index beside it.
// Wide screens: a sidebar you can show or hide. Phones: a drawer that slides in over the page.
export function CourseShell({ index, actions, children }: { index: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  const desktopOpen = useSyncExternalStore(subscribe, readOpen, () => true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 900px)'); // MUI's md breakpoint

  const toggle = () => {
    if (isDesktop) {
      writeOpen(!desktopOpen);
    } else {
      setMobileOpen(true);
    }
  };

  return (
    <Box className={styles.shell}>
      {/* Wide screens: a sidebar that slides open and closed (see the CSS for how). */}
      <Box id={INDEX_ID} aria-hidden={!desktopOpen || undefined}
        className={desktopOpen ? styles.column : `${styles.column} ${styles.closed}`}>
        <Box component="nav" aria-label="Course index" className={styles.panel}>
          {index}
        </Box>
      </Box>

      {/* Phones: closes itself when a link inside is followed. */}
      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)}
        className={styles.drawer}
        slotProps={{ paper: { component: 'nav', 'aria-label': 'Course index', className: styles.drawerPaper } as object }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a')) {
            setMobileOpen(false);
          }
        }}>
        <Box className={styles.drawerClose}>
          <IconButton onClick={() => setMobileOpen(false)} aria-label="Close course index"><CloseIcon /></IconButton>
        </Box>
        {index}
      </Drawer>

      <Box className={styles.content}>
        <Box className={styles.toolbar}>
        <Button onClick={toggle} color="secondary" size="small"
          aria-controls={INDEX_ID}
          aria-expanded={isDesktop ? desktopOpen : mobileOpen}
          startIcon={desktopOpen ? <MenuOpenIcon /> : <MenuIcon />}
          className={desktopOpen ? styles.toggle : `${styles.toggle} ${styles.toggleClosed}`}>
          <span className={styles.labelOpen}>Hide course index</span>
          <span className={styles.labelClosed}>Course index</span>
        </Button>
        {actions}
        </Box>
        {children}
      </Box>
    </Box>
  );
}
