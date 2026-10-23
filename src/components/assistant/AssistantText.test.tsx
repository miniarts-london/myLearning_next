import { describe, expect, it } from 'vitest';
import { renderWithTheme, screen } from '@/test/render';
import { AssistantText, isAppLink, toBlocks } from './AssistantText';

describe('isAppLink', () => {
  it('allows links inside the app only', () => {
    expect(isAppLink('/courses/2/activities/11')).toBe(true);
    expect(isAppLink('/dashboard')).toBe(true);
    expect(isAppLink('https://evil.example')).toBe(false);
    expect(isAppLink('//evil.example')).toBe(false); // Protocol-relative: another site
    expect(isAppLink('javascript:alert(1)')).toBe(false);
  });
});

describe('toBlocks', () => {
  it('splits paragraphs and lists', () => {
    expect(toBlocks('Hello\nthere\n\n- one\n- two\n1. first')).toEqual([
      { kind: 'p', lines: ['Hello', 'there'] },
      { kind: 'ul', items: ['one', 'two'] },
      { kind: 'ol', items: ['first'] },
    ]);
  });
});

describe('AssistantText', () => {
  it('renders links into the app, bold text and lists', () => {
    renderWithTheme(<AssistantText text={'Start with **this**:\n- [Contrast ratios](/courses/2/activities/21)\n- the quiz'} />);
    expect(screen.getByRole('link', { name: 'Contrast ratios' })).toHaveAttribute('href', '/courses/2/activities/21');
    expect(screen.getByText('this').tagName).toBe('STRONG');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('never renders HTML or links to other sites', () => {
    renderWithTheme(<AssistantText text={'<img src=x onerror="alert(1)"> [click](https://evil.example)'} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/<img src=x/)).toHaveTextContent('<img src=x onerror="alert(1)"> click');
  });
});
