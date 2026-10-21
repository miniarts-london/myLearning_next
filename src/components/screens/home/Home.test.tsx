import { describe, expect, it } from 'vitest';
import { renderWithTheme, screen } from '@/test/render';
import { course } from '@/test/fixtures';
import { HomeScreen } from './Home';

// HomeScreen only receives props (the page fetches the data), so it can be tested on its own
// with sample data. Queries follow what a learner perceives: roles and accessible names,
// the same way a screen reader finds things, not CSS classes.

describe('HomeScreen', () => {
  it('greets the learner by first name as the page heading', () => {
    renderWithTheme(<HomeScreen firstname="Sam" courses={[course()]} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back, Sam' })).toBeInTheDocument();
  });

  it('has exactly one main heading', () => {
    renderWithTheme(<HomeScreen firstname="Sam" courses={[]} />);

    // One h1 per page: screen reader users jump to it to find out where they are.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('shows the name as text, never as HTML', () => {
    renderWithTheme(<HomeScreen firstname={'<img src=x onerror="alert(1)">'} courses={[]} />);

    // React escapes text, so markup in a name is shown, not run.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back, <img src=x onerror="alert(1)">');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  // The home page is still being built. These describe what it should do next: turn each
  // one into a real test (it(...)) as the feature is added. Vitest lists them as "todo".
  it.todo('lists each enrolled course with a link to its course page');
  it.todo("shows each course's progress as a labelled progress bar");
  it.todo('suggests the course catalogue when there are no courses');
});
