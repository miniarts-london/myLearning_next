'use client';

import { createTheme } from '@mui/material/styles';

const plum = '#aa0766';
const yellow = '#ffde00';
const black = '#000';

// The one place to change the app's colours, fonts and shapes.
// cssVariables: true also publishes every value as a CSS variable (--mui-palette-primary-main…),
// which globals.css uses, so plain CSS and MUI components always match.
export const theme = createTheme({
  cssVariables: true,
  palette: {
    primary: { main: plum, contrastText: black },   // MyLearning plum
    secondary: { main: black, contrastText: '#fff' },
    success: { main: '#3f7020', contrastText: '#fff' },   // Progress and "Done"
    error: { main: '#b00020' },
    text: { primary: '#48484d', secondary: '#5c5c62' },
    divider: '#e2e2e2',
    background: { default: '#fff', paper: '#fff' },
  },
  typography: {
    fontFamily: '"Open Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    button: { fontWeight: 400, letterSpacing: '.02em' },
  },
  shape: { borderRadius: 0 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          fontSize: '.875rem',
          padding: '.55rem 1.1rem',
          variants: [
            { props: { size: 'small' }, style: { fontSize: '.75rem', padding: '.3rem .8rem' } },
            { props: { size: 'large' }, style: { fontSize: '1rem', minHeight: '3rem' } },
            // The MyLearning hover: plum buttons turn black with plum text…
            { props: { variant: 'contained', color: 'primary' }, style: { '&:hover': { backgroundColor: black, color: yellow } } },
            // …and black outline buttons fill black.
            { props: { variant: 'outlined', color: 'secondary' }, style: { '&:hover': { backgroundColor: black, color: '#fff' } } },
          ],
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: '.5rem' },
      },
    },
  },
});
