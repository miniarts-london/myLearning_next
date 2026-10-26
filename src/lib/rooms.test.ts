import { describe, expect, it } from 'vitest';
import {
  canEditRoom,
  canViewRoom,
  classPeople,
  classesForPerson,
  cleanLabel,
  cleanGuestEmail,
  cleanNote,
  desksForPeople,
  draggedSpot,
  freePosition,
  gridPosition,
  planPoint,
  spotFromPointer,
  mergeCourses,
  peopleChanged,
  personDetailsFor,
  pruneRoom,
  sanitiseDesks,
  sharedClassCourses,
  toRoomView,
  userPersonId,
  type RoomAccess,
  type RoomRecord,
} from './rooms';

const student: RoomAccess = { userId: 5, isAdmin: false, staffCourseIds: [], enrolledCourseIds: [8] };
const teacher: RoomAccess = { userId: 2, isAdmin: false, staffCourseIds: [8], enrolledCourseIds: [8] };
const admin: RoomAccess = { userId: 1, isAdmin: true, staffCourseIds: [], enrolledCourseIds: [] };

function room(overrides: Partial<RoomRecord> = {}): RoomRecord {
  return {
    id: 'room-1',
    name: 'Tuesday',
    kind: 'class',
    courseId: 8,
    ownerId: 2,
    desks: [],
    people: [{ id: 'user:5', name: 'Ada Lovelace', userId: 5 }],
    notes: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('who can change a room', () => {
  const lesson = room();
  const meeting = room({ kind: 'meeting', courseId: null, ownerId: 2, people: [{ id: 'user:5', name: 'Ada Lovelace', userId: 5 }] });

  it('lets a teacher of the class arrange it, and a student only look', () => {
    expect(canEditRoom(lesson, teacher)).toBe(true);
    expect(canViewRoom(lesson, teacher)).toBe(true);
    expect(canEditRoom(lesson, student)).toBe(false);
    expect(canViewRoom(lesson, student)).toBe(true);
  });

  it('hides a class from someone who is not enrolled', () => {
    const outsider: RoomAccess = { userId: 9, isAdmin: false, staffCourseIds: [], enrolledCourseIds: [3] };
    expect(canViewRoom(lesson, outsider)).toBe(false);
  });

  it('lets the meeting owner arrange it, and a seated person only look', () => {
    expect(canEditRoom(meeting, teacher)).toBe(true);
    expect(canEditRoom(meeting, student)).toBe(false);
    expect(canViewRoom(meeting, student)).toBe(true);
  });

  it('lets a site admin arrange any room', () => {
    expect(canEditRoom(lesson, admin)).toBe(true);
    expect(canEditRoom(meeting, admin)).toBe(true);
  });
});

describe('class list', () => {
  it('keeps students, including the person viewing, and leaves teachers and admins out', () => {
    const people = classPeople([
      { id: 2, fullname: 'Grace Hopper', roles: [{ shortname: 'editingteacher' }] },
      { id: 1, fullname: 'Admin', roles: [{ shortname: 'student' }] },
      { id: 5, fullname: 'Ada Lovelace', roles: [{ shortname: 'student' }] },
      { id: 4, fullname: 'Alan Turing', roles: [{ shortname: 'student' }] },
    ], new Set([1]));
    expect(people.map((person) => person.name)).toEqual(['Ada Lovelace', 'Alan Turing']);
    expect(people[0].id).toBe(userPersonId(5));
  });
});

describe('layout', () => {
  it('spaces a new class across the floor', () => {
    expect(gridPosition(0)).toEqual({ x: 12, y: 16 });
    expect(gridPosition(5)).toEqual({ x: 12, y: 31 });
    const desks = desksForPeople([
      { id: 'user:1', name: 'Ada' },
      { id: 'user:2', name: 'Alan' },
    ], () => 'desk');
    expect(desks).toHaveLength(2);
    expect(desks[0]).toMatchObject({ personId: 'user:1', x: 12, y: 16 });
  });

  it('puts the next person in a free seat', () => {
    expect(freePosition([{ x: 12, y: 16 }])).toEqual(gridPosition(1));
  });

  it('turns a student plan 180 degrees from the teacher plan', () => {
    const rect = { left: 0, top: 0, width: 100, height: 100 };
    const teacher = planPoint(12, 16, true);
    const student = planPoint(12, 16, false);
    expect(teacher).toEqual({ left: 12, top: 84 });
    expect(student).toEqual({ left: 100 - teacher.left, top: 100 - teacher.top });
    expect(spotFromPointer(20, 90, rect, true)).toEqual({ x: 20, y: 10 });
    expect(spotFromPointer(80, 10, rect, false)).toEqual({ x: 20, y: 10 });
    expect(draggedSpot(40, 50, 10, 10, true)).toEqual({ x: 50, y: 40 });
    expect(draggedSpot(40, 50, 10, 10, false)).toEqual({ x: 30, y: 60 });
    expect(draggedSpot(40, 50, 0, -2, true)).toEqual({ x: 40, y: 52 });
  });

  it('drops people who have left, and rejects a layout that is not a layout', () => {
    const pruned = pruneRoom(
      [{ id: 'd1', personId: 'user:5', x: 10, y: 10 }, { id: 'd2', personId: 'user:9', x: 20, y: 20 }],
      [{ personId: 'user:9', text: 'Old note', updatedAt: 't' }, { personId: 'user:5', text: '  ', updatedAt: 't' }],
      [{ id: 'user:5', name: 'Ada', userId: 5 }],
    );
    expect(pruned.desks.map((desk) => desk.personId)).toEqual(['user:5']);
    expect(pruned.notes).toEqual([]);

    const people = [{ id: 'user:5', name: 'Ada', userId: 5 }];
    expect(sanitiseDesks([{ id: 'd1', personId: 'user:5', x: 1, y: 200 }], people)).toEqual([
      { id: 'd1', personId: 'user:5', x: 4, y: 96 },
    ]);
    expect(sanitiseDesks([{ id: 'd1', personId: 'user:missing', x: 10, y: 10 }], people)).toBeNull();
    expect(sanitiseDesks('nope', people)).toBeNull();
  });

  it('notices when the class list itself has changed', () => {
    const ada = { id: 'user:5', name: 'Ada', userId: 5 };
    expect(peopleChanged([ada], [ada])).toBe(false);
    expect(peopleChanged([ada], [{ ...ada, name: 'Ada Lovelace' }])).toBe(true);
  });
});

describe('names and notes', () => {
  it('trims a room name and refuses an empty one', () => {
    expect(cleanLabel('  Lab  one ', 80)).toEqual({ ok: true, value: 'Lab one' });
    expect(cleanLabel('   ', 80)).toEqual({ ok: false, reason: 'empty' });
    expect(cleanLabel('x'.repeat(81), 80)).toEqual({ ok: false, reason: 'long' });
  });

  it('lets a blank note clear the old one, and refuses a very long one', () => {
    expect(cleanNote('  Sits at the front  ')).toEqual({ ok: true, value: 'Sits at the front' });
    expect(cleanNote('   ')).toEqual({ ok: true, value: '' });
    expect(cleanNote('x'.repeat(501)).ok).toBe(false);
  });

  it('keeps a guest email, and refuses one that is not an email', () => {
    expect(cleanGuestEmail('  Mollie@example.com ')).toEqual({ ok: true, value: 'Mollie@example.com' });
    expect(cleanGuestEmail('   ')).toEqual({ ok: true, value: '' });
    expect(cleanGuestEmail('not an email')).toEqual({ ok: false, reason: 'bad' });
    expect(cleanGuestEmail(`${'a'.repeat(250)}@b.co`)).toEqual({ ok: false, reason: 'long' });
  });
});

describe('what a person sees', () => {
  it('shows notes to a teacher and hides them from a student', () => {
    const lesson = room({
      desks: [{ id: 'd1', personId: 'user:5', x: 12, y: 16 }],
      notes: [{ personId: 'user:5', text: 'Needs the aisle', updatedAt: 't' }],
      people: [
        { id: 'user:5', name: 'Ada Lovelace', userId: 5 },
        { id: 'user:4', name: 'Alan Turing', userId: 4 },
      ],
    });
    const asStudent = toRoomView(lesson, 5, false, 'Biology');
    expect(asStudent.seats[0]).toMatchObject({ name: 'Ada Lovelace', isYou: true, note: null });
    expect(asStudent.unseated.map((person) => person.name)).toEqual(['Alan Turing']);

    const asTeacher = toRoomView(lesson, 2, true, 'Biology');
    expect(asTeacher.seats[0].note).toBe('Needs the aisle');
    expect(asTeacher.canEdit).toBe(true);
  });
});

describe('person details', () => {
  const now = 1_700_000_000;
  const courses = [{ id: 8, name: 'Biology' }];
  const classes = [{ id: 'room-1', name: 'Tuesday' }];
  const alan = { id: 'user:4', userId: 4 };
  const lesson = room({
    people: [
      { id: 'user:5', name: 'Ada Lovelace', userId: 5 },
      { id: 'user:4', name: 'Alan Turing', userId: 4 },
    ],
  });
  const thursday = room({
    id: 'room-2',
    name: 'Thursday lab',
    people: [{ id: 'user:4', name: 'Alan Turing', userId: 4 }],
  });
  const hidden = room({
    id: 'room-hidden',
    name: 'Other class',
    courseId: 9,
    people: [{ id: 'user:4', name: 'Alan Turing', userId: 4 }],
  });
  const meeting = room({
    id: 'meet',
    name: 'Standup',
    kind: 'meeting',
    courseId: null,
    people: [{ id: 'user:4', name: 'Alan Turing', userId: 4 }],
  });

  it('lists only class rooms the viewer can open', () => {
    const rooms = [thursday, lesson, hidden, meeting];
    expect(classesForPerson(rooms, alan, student).map((item) => item.name)).toEqual(['Thursday lab', 'Tuesday']);
    expect(sharedClassCourses(rooms, alan, student)).toEqual([8]);
    expect(classesForPerson(rooms, { id: 'guest:1' }, student)).toEqual([]);
  });

  it('keeps the first name when the same course turns up twice', () => {
    expect(mergeCourses(
      [{ id: 8, name: 'Biology' }, { id: 3, name: 'Art' }],
      [{ id: 8, name: 'Biology again' }, { id: 1, name: 'Algebra' }],
    )).toEqual([
      { id: 1, name: 'Algebra' },
      { id: 3, name: 'Art' },
      { id: 8, name: 'Biology' },
    ]);
  });

  it('shows a teacher the email and status, and lets them write', () => {
    expect(personDetailsFor({
      staff: true,
      isYou: false,
      hasAccount: true,
      email: 'alan@example.test',
      courses,
      classes,
      lastAccess: now - 86400,
      suspended: false,
      now,
    })).toEqual({
      email: 'alan@example.test',
      courses,
      classes,
      status: 'Last visit: Yesterday',
      canMessage: true,
      canEditEmail: false,
    });
  });

  it('hides email and status from a student, who can still write', () => {
    expect(personDetailsFor({
      staff: false,
      isYou: false,
      hasAccount: true,
      email: 'alan@example.test',
      courses,
      classes,
      lastAccess: now,
      suspended: true,
      now,
    })).toEqual({
      email: null,
      courses,
      classes,
      status: null,
      canMessage: true,
      canEditEmail: false,
    });
  });

  it('will not let you message yourself or a guest, and says when an email was withheld', () => {
    expect(personDetailsFor({
      staff: false, isYou: true, hasAccount: true, email: 'me@example.test', courses, classes, lastAccess: 0, suspended: false, now,
    })).toMatchObject({ email: null, status: null, canMessage: false });

    expect(personDetailsFor({
      staff: true, isYou: false, hasAccount: false, email: '', courses: [], classes, lastAccess: 0, suspended: false, now,
    })).toEqual({ email: '', courses: [], classes, status: 'Guest', canMessage: false, canEditEmail: true });

    expect(personDetailsFor({
      staff: true, isYou: false, hasAccount: false, email: ' mollie@example.com ', courses: [], classes, lastAccess: 0, suspended: false, now,
    })).toMatchObject({ email: 'mollie@example.com', canEditEmail: true, canMessage: false });

    expect(personDetailsFor({
      staff: false, isYou: false, hasAccount: false, email: 'secret@example.test', courses: [], classes, lastAccess: 0, suspended: false, now,
    })).toMatchObject({ email: null, status: null, canMessage: false, canEditEmail: false });

    expect(personDetailsFor({
      staff: true, isYou: false, hasAccount: true, email: '  ', courses, classes, lastAccess: 0, suspended: true, now,
    })).toMatchObject({ email: 'Not shared', status: 'Suspended', canMessage: true });

    expect(personDetailsFor({
      staff: true, isYou: false, hasAccount: true, email: '', courses, classes, lastAccess: 0, suspended: false, now,
    }).status).toBe('Never visited');
  });
});
