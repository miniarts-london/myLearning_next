import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithTheme, screen } from '@/test/render';
import { CircularProgressWithLabel } from './CircularProgressWithLabel';

// Pretends the learner has (or hasn't) turned on "reduce motion".
function prefersReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }));
}

afterEach(() => vi.unstubAllGlobals());

describe('CircularProgressWithLabel', () => {
  it('is one progress bar with its real value from the start, whatever the animation shows', () => {
    prefersReducedMotion(false);
    renderWithTheme(<CircularProgressWithLabel value={33.4} label="Course progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Course progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '33'); // Screen readers never hear the count-up
    expect(screen.getAllByRole('progressbar')).toHaveLength(1); // The track is hidden from them
  });

  it('counts the number up to the value', async () => {
    prefersReducedMotion(false);
    renderWithTheme(<CircularProgressWithLabel value={60} label="Progress" duration={200} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(await screen.findByText('60%', {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('jumps straight to the value when the learner prefers reduced motion', async () => {
    prefersReducedMotion(true);
    renderWithTheme(<CircularProgressWithLabel value={60} label="Progress" duration={5000} />);
    expect(await screen.findByText('60%', {}, { timeout: 500 })).toBeInTheDocument();
  });

  it('is 150px by 150px unless told otherwise', () => {
    prefersReducedMotion(true);
    const { container, rerender } = renderWithTheme(<CircularProgressWithLabel value={50} label="Progress" />);
    // The CSS sizes the ring from this variable.
    const size = () => (container.firstElementChild as HTMLElement).style.getPropertyValue('--ring-size');
    expect(size()).toBe('150px');
    rerender(<CircularProgressWithLabel value={50} label="Progress" size={80} />);
    expect(size()).toBe('80px');
  });

  it('keeps the value between 0 and 100', async () => {
    prefersReducedMotion(true);
    renderWithTheme(<CircularProgressWithLabel value={140} label="Progress" />);
    expect(await screen.findByText('100%')).toBeInTheDocument();
  });

  it('uses the colour it is given, info by default', () => {
    prefersReducedMotion(true);
    const { rerender } = renderWithTheme(<CircularProgressWithLabel value={50} label="Progress" />);
    expect(screen.getByRole('progressbar', { name: 'Progress' })).toHaveClass('MuiCircularProgress-colorInfo');
    rerender(<CircularProgressWithLabel value={50} label="Progress" color="success" />);
    expect(screen.getByRole('progressbar', { name: 'Progress' })).toHaveClass('MuiCircularProgress-colorSuccess');
  });
});
