'use client';

import { createTheme } from '@mui/material/styles';
import type { LinkProps } from '@mui/material/Link';
import { LinkBehaviour } from '@/components/LinkBehaviour';

const plum = '#aa0766';
const black = '#000';
const ink = '#343a40'; // Headings

// The one place to change the app's colours, fonts and shapes.
// cssVariables: true also publishes every value as a CSS variable (--mui-palette-primary-main…),
// which globals.css uses, so plain CSS and MUI components always match.
export const theme = createTheme({
  cssVariables: true,
  palette: {
    // White text on plum: black text on plum is only about 3:1, below the 4.5:1 WCAG AA needs.
    primary: { main: plum, contrastText: '#fff' },
    secondary: { main: black, contrastText: '#fff' },
    // Your green with dark text: white on #459e60 is only 3.3:1 (WCAG needs 4.5:1); black is 6.3:1.
    success: { main: '#459e60', contrastText: '#000' },   // Progress and "Done"
    error: { main: '#b00020' },
    info: { main: '#218fbe', contrastText: '#fff' },      // Links and "Ask this course"
    // Darker than MUI's default orange (#ed6c02, about 3:1 on white), so warning text passes 4.5:1.
    warning: { main: '#b45309', contrastText: '#fff' },
    text: { primary: '#48484d', secondary: '#5c5c62' },
    divider: '#e2e2e2',
    background: { default: '#fff', paper: '#fff' },
  },
  typography: {
    fontFamily: '"Open Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    h1: { fontSize: 'clamp(1.75rem, 1.4rem + 1.2vw, 2.25rem)', fontWeight: 300, lineHeight: 1.2, color: ink },
    h2: { fontSize: '1.5rem', fontWeight: 300, lineHeight: 1.2, color: ink },
    h3: { fontSize: '1.25rem', fontWeight: 400, lineHeight: 1.3, color: ink },
    button: { fontWeight: 400, letterSpacing: '.02em' },
    overline: { fontSize: '.75rem', lineHeight: 1.5 },
  },
  shape: { borderRadius: 0 },
  components: {
    // App links go through Next.js routing.
    MuiLink: {
      defaultProps: { component: LinkBehaviour, color: 'secondary' } as LinkProps,
      styleOverrides: { root: { textUnderlineOffset: '.2em' } },
    },
    MuiButtonBase: { defaultProps: { LinkComponent: LinkBehaviour } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          fontSize: '.875rem',
          padding: '.55rem 1.1rem',
          variants: [
            { props: { size: 'small' }, style: { fontSize: '.75rem', padding: '.3rem .8rem' } },
            { props: { size: 'large' }, style: { fontSize: '1rem', minHeight: '3rem' } },
            // The MyLearning hover: coloured buttons turn black…
            { props: { variant: 'contained', color: 'primary' }, style: { '&:hover': { backgroundColor: black, color: '#fff' } } },
            // …and black outline buttons fill black.
            { props: { variant: 'outlined', color: 'secondary' }, style: { '&:hover': { backgroundColor: black, color: '#fff' } } },
          ],
        },
      },
    },
    MuiAppBar: {
      defaultProps: { position: 'static', color: 'inherit', elevation: 0 },
      styleOverrides: { root: { boxShadow: '0 2px 1rem rgba(0, 0, 0, .06)' } },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { boxShadow: '0 0 1.25rem rgba(0, 0, 0, .06)', height: '100%' } },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { height: '.5rem' } },
    },
    MuiTextField: {
      defaultProps: { variant: 'standard', fullWidth: true },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontWeight: 600, textTransform: 'uppercase', color: ink } },
    },
  },
});
