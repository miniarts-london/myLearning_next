import type { Metadata } from 'next';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from '@/theme';
import '@/css/globals.css';

export const metadata: Metadata = {
  title: { default: 'MyLearning', template: '%s | MyLearning' },
  description: 'A Next.js front end for a Moodle site.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: a tiny script may add data-welcome to <html> before React starts
    // (see the welcome animation in (app)/layout.tsx).
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Collects MUI's styles during server rendering, so pages arrive already styled.
            enableCssLayer puts MUI's own styles in a CSS layer, so the styles in src/css always
            win over MUI's defaults, whatever order they load in. */}
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
