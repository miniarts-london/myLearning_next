import { describe, expect, it } from 'vitest';
import { onPlatform, parseCourseIds } from './platform';

describe('parseCourseIds', () => {
  it('means every course when unset or empty', () => {
    expect(parseCourseIds(undefined)).toBeNull();
    expect(parseCourseIds('')).toBeNull();
    expect(parseCourseIds(' , ')).toBeNull();
  });

  it('reads a comma-separated list, allowing spaces', () => {
    expect(parseCourseIds('1,3,4')).toEqual(new Set([1, 3, 4]));
    expect(parseCourseIds(' 1 , 3,4 ')).toEqual(new Set([1, 3, 4]));
  });

  it('ignores anything that is not a course id', () => {
    expect(parseCourseIds('2,abc,0,-5,3.5,7')).toEqual(new Set([2, 7]));
    expect(parseCourseIds('abc')).toBeNull();
  });
});

describe('onPlatform', () => {
  it('shows every course without a list', () => {
    expect(onPlatform(99, null)).toBe(true);
  });

  it('shows only the listed courses', () => {
    const ids = new Set([1, 3, 4]);
    expect(onPlatform(3, ids)).toBe(true);
    expect(onPlatform(2, ids)).toBe(false);
  });
});
