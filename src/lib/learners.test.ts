import { describe, expect, it } from 'vitest';
import { isComplete, isInactive, isStaff, lastVisitLabel } from './learners';

const NOW = 1_800_000_000;
const DAY = 86400;

describe('isStaff', () => {
  it('lets teachers, non-editing teachers and managers see learners', () => {
    expect(isStaff(['editingteacher'], false)).toBe(true);
    expect(isStaff(['teacher'], false)).toBe(true);
    expect(isStaff(['manager'], false)).toBe(true);
  });
  it('lets site admins see any course, enrolled or not', () => {
    expect(isStaff([], true)).toBe(true);
    expect(isStaff(['student'], true)).toBe(true);
  });
  it('keeps students and everyone else out', () => {
    expect(isStaff(['student'], false)).toBe(false);
    expect(isStaff([], false)).toBe(false);
  });
});

describe('lastVisitLabel', () => {
  it('describes how long ago, in words', () => {
    expect(lastVisitLabel(0, NOW)).toBe('Never');
    expect(lastVisitLabel(NOW - 60, NOW)).toBe('Today');
    expect(lastVisitLabel(NOW - DAY - 60, NOW)).toBe('Yesterday');
    expect(lastVisitLabel(NOW - 5 * DAY, NOW)).toBe('5 days ago');
    expect(lastVisitLabel(NOW - 21 * DAY, NOW)).toBe('3 weeks ago');
    expect(lastVisitLabel(NOW - 90 * DAY, NOW)).toBe('3 months ago');
  });
});

describe('isInactive', () => {
  it('means not visited for two weeks or more, or never', () => {
    expect(isInactive(NOW - 13 * DAY, NOW)).toBe(false);
    expect(isInactive(NOW - 14 * DAY, NOW)).toBe(true);
    expect(isInactive(0, NOW)).toBe(true);
  });
});

describe('isComplete', () => {
  it('counts complete and passed, not failed or not started', () => {
    expect([0, 1, 2, 3].map(isComplete)).toEqual([false, true, true, false]);
  });
});
