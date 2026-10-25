import { describe, expect, it } from 'vitest';
import { decodeEntities, decodeNames } from './entities';

describe('decodeEntities', () => {
  it('turns HTML codes back into characters', () => {
    expect(decodeEntities('Business &amp; Careers')).toBe('Business & Careers');
    expect(decodeEntities('Tom&#39;s &quot;quiz&quot; &lt;1&gt;')).toBe('Tom\'s "quiz" <1>');
    expect(decodeEntities('Caf&#xe9; &#233;')).toBe('Café é');
  });

  it('leaves everything else as it is', () => {
    expect(decodeEntities('Plain name')).toBe('Plain name');
    expect(decodeEntities('A & B')).toBe('A & B');
    expect(decodeEntities('&unknown;')).toBe('&unknown;');
  });
});

describe('decodeNames', () => {
  it('decodes name fields at any depth, but not HTML fields', () => {
    const response = {
      courses: [{ fullname: 'Design &amp; UX', summary: '<p>Fish &amp; chips</p>', sections: [{ name: 'Q&amp;A', modules: [{ name: 'Tips &amp; tricks' }] }] }],
    };
    expect(decodeNames(response)).toEqual({
      courses: [{ fullname: 'Design & UX', summary: '<p>Fish &amp; chips</p>', sections: [{ name: 'Q&A', modules: [{ name: 'Tips & tricks' }] }] }],
    });
  });
});
