import '@testing-library/jest-dom/vitest'; // Adds matchers like toBeInTheDocument() and toHaveTextContent()
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Remove what each test rendered, so tests can't affect each other.
afterEach(() => cleanup());
