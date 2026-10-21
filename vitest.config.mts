import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Unit and component tests (React Testing Library). They render one component at a time in a
// simulated browser (jsdom), with sample data: no Next.js server, no Moodle. Fast enough to run
// on every save. Whole-app journeys are covered by the Playwright tests in e2e/.
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true }, // The @/… imports from tsconfig.json
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
