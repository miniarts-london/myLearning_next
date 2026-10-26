import { describe, expect, it } from 'vitest';
import { bySubmissionsPriority, checkGrade, formatGrade, markingStatus, needsGrading, parseGrade, summariseAssignment } from './marking';

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

describe('summariseAssignment', () => {
  const DAY = 86_400;
  const now = 100 * DAY;
  const students = [1, 2, 3, 4];
  const subs = [
    { userid: 1, status: 'submitted' }, { userid: 2, status: 'submitted' }, { userid: 3, status: 'draft' },
    { userid: 9, status: 'submitted' }, // not a student (the teacher trying it out): not counted
  ];
  const grades = [{ userid: 1, grade: '7.00000' }, { userid: 3, grade: '-1.00000' }, { userid: 9, grade: '5.00000' }];

  it('counts submitted, to grade, graded and missing work among the students', () => {
    expect(summariseAssignment({ cmid: 13, name: 'Audit', duedate: 0 }, students, subs, grades, now)).toEqual({
      cmid: 13, name: 'Audit', duedate: 0, students: 4, submitted: 2, toGrade: 1, graded: 1, missing: 2, overdue: false,
    });
  });
  it('is overdue once the due date has passed with work still missing', () => {
    expect(summariseAssignment({ cmid: 1, name: 'A', duedate: 99 * DAY }, students, subs, grades, now).overdue).toBe(true);
    expect(summariseAssignment({ cmid: 1, name: 'A', duedate: 101 * DAY }, students, subs, grades, now).overdue).toBe(false);
    const allIn = students.map((userid) => ({ userid, status: 'submitted' }));
    expect(summariseAssignment({ cmid: 1, name: 'A', duedate: 99 * DAY }, students, allIn, [], now).overdue).toBe(false);
  });
});

describe('bySubmissionsPriority', () => {
  const row = (name: string, toGrade: number, duedate: number) =>
    ({ cmid: 0, name, duedate, students: 5, submitted: 0, toGrade, graded: 0, missing: 0, overdue: false });
  it('puts the most to grade first, then the soonest due, with no due date last', () => {
    const rows = [row('No date', 1, 0), row('Later', 1, 300), row('Sooner', 1, 200), row('Lots', 4, 900), row('None to grade', 0, 100)];
    expect(rows.sort(bySubmissionsPriority).map((r) => r.name)).toEqual(['Lots', 'Sooner', 'Later', 'No date', 'None to grade']);
  });
});
