import { describe, expect, it } from 'vitest';
import { checkGrade, formatGrade, markingStatus, needsGrading, parseGrade } from './marking';

describe('checkGrade', () => {
  it('accepts a grade from 0 to the maximum, to two decimal places', () => {
    expect(checkGrade('7', 10)).toEqual({ grade: 7 });
    expect(checkGrade(' 9.25 ', 10)).toEqual({ grade: 9.25 });
    expect(checkGrade('0', 10)).toEqual({ grade: 0 });
  });
  it('explains what is wrong otherwise', () => {
    expect(checkGrade('', 10)).toEqual({ error: 'Enter a grade.' });
    expect(checkGrade('abc', 10)).toEqual({ error: 'The grade must be a number.' });
    expect(checkGrade('11', 10)).toEqual({ error: 'The grade must be between 0 and 10.' });
    expect(checkGrade('-1', 10)).toEqual({ error: 'The grade must be between 0 and 10.' });
    expect(checkGrade('7.125', 10)).toEqual({ error: 'Use at most two decimal places.' });
  });
});

describe('Moodle values', () => {
  it('reads grades sent as text, treating -1 and blank as not graded', () => {
    expect(parseGrade('7.00000')).toBe(7);
    expect(parseGrade('-1.00000')).toBeNull();
    expect(parseGrade('')).toBeNull();
    expect(parseGrade(undefined)).toBeNull();
  });
  it('shows grades without needless decimals', () => {
    expect(formatGrade(7)).toBe('7');
    expect(formatGrade(9.5)).toBe('9.5');
    expect(formatGrade(9.25)).toBe('9.25');
  });
  it('sorts statuses into submitted, draft and not submitted', () => {
    expect(['submitted', 'draft', 'new', 'reopened', undefined].map(markingStatus)).toEqual(['submitted', 'draft', 'notsubmitted', 'notsubmitted', 'notsubmitted']);
  });
  it('flags submitted work with no grade as needing grading', () => {
    const row = { userid: 1, name: 'A', submittedAt: 1, textHtml: '', files: [] };
    expect(needsGrading({ ...row, status: 'submitted', grade: null })).toBe(true);
    expect(needsGrading({ ...row, status: 'submitted', grade: 5 })).toBe(false);
    expect(needsGrading({ ...row, status: 'draft', grade: null })).toBe(false);
  });
});
