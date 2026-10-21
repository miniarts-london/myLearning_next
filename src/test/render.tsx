import { render, type RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@/theme';

// Renders a component the way the app does: inside the MUI theme, so colours, typography and
// the Next.js-aware links are the real ones. Use this instead of RTL's render().
export function renderWithTheme(ui: React.ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: ({ children }) => <ThemeProvider theme={theme}>{children}</ThemeProvider>, ...options });
}

export * from '@testing-library/react';
