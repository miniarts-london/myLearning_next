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

const INDEX_ID = 'course-index';
const WIDTH = 300;
// How long the sidebar takes to open or close, in milliseconds. Change it here only.
const SPEED = 400;

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
    <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
      {/* Wide screens. Opening and closing animate: the column slides its width (and the gap
          beside it) between 0 and full, while the panel inside slides and fades.
          `visibility` waits until the closing slide has finished, then hides the panel, so its
          links can't be tabbed to while it's closed. */}
      <Box id={INDEX_ID} aria-hidden={!desktopOpen || undefined}
        sx={(theme) => {
          const slide = theme.transitions.create(['width', 'margin-right'], {
            duration: SPEED, easing: theme.transitions.easing.easeInOut,
          });
          return {
            display: { xs: 'none', md: 'block' },
            flexShrink: 0, position: 'sticky', top: 16, overflow: 'hidden',
            width: desktopOpen ? WIDTH : 0,
            mr: desktopOpen ? 4 : 0,
            visibility: desktopOpen ? 'visible' : 'hidden',
            transition: desktopOpen
              ? `${slide}, visibility 0s`
              : `${slide}, visibility 0s ${SPEED}ms`,
          };
        }}>
        <Box component="nav" aria-label="Course index"
          sx={(theme) => ({
            width: WIDTH, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
            bgcolor: 'background.paper', boxShadow: '0 0 1.25rem rgba(0, 0, 0, .06)', pb: 1,
            opacity: desktopOpen ? 1 : 0,
            transform: desktopOpen ? 'none' : 'translateX(-1.5rem)',
            transition: theme.transitions.create(['opacity', 'transform'], { duration: SPEED }),
          })}>
          {index}
        </Box>
      </Box>

      {/* Phones: closes itself when a link inside is followed. */}
      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)}
        sx={{ display: { md: 'none' } }}
        slotProps={{ paper: { component: 'nav', 'aria-label': 'Course index', sx: { width: `min(${WIDTH}px, 85vw)` } } as object }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a')) {
            setMobileOpen(false);
          }
        }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 0.5 }}>
          <IconButton onClick={() => setMobileOpen(false)} aria-label="Close course index"><CloseIcon /></IconButton>
        </Box>
        {index}
      </Drawer>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, alignItems: 'center' }}>
        <Button onClick={toggle} color="secondary" size="small"
          aria-controls={INDEX_ID}
          aria-expanded={isDesktop ? desktopOpen : mobileOpen}
          startIcon={desktopOpen ? <MenuOpenIcon /> : <MenuIcon />}
          sx={{ mb: 2, ml: -1, '& .label-open': { display: { xs: 'none', md: desktopOpen ? 'inline' : 'none' } }, '& .label-closed': { display: { xs: 'inline', md: desktopOpen ? 'none' : 'inline' } } }}>
          <span className="label-open">Hide course index</span>
          <span className="label-closed">Course index</span>
        </Button>
        {actions}
        </Box>
        {children}
      </Box>
    </Box>
  );
}
