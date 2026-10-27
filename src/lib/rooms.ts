import { lastVisitLabel } from './learners';

// Seating plans for in-person classes and meetings. Pure rules only: no files, no Moodle.
// A class takes its people from the course. A meeting keeps its own list (students from a
// class, or guests typed by name). Positions are percentages of the floor, 4–96.

export const ROOM_NAME_MAX = 80;
export const GUEST_NAME_MAX = 80;
export const GUEST_EMAIL_MAX = 254;
export const NOTE_MAX = 500;
export const ROOM_PEOPLE_MAX = 40;

export type RoomKind = 'class' | 'meeting';

export interface RoomPerson {
  id: string;
  name: string;
  userId?: number;
  /** Set for a guest when a teacher has saved an address. Students are not sent this. */
  email?: string;
}

export interface Desk {
  id: string;
  personId: string;
  x: number;
  y: number;
}

export interface RoomNote {
  personId: string;
  text: string;
  updatedAt: string;
}

export interface RoomRecord {
  id: string;
  name: string;
  kind: RoomKind;
  courseId: number | null;
  ownerId: number;
  desks: Desk[];
  /** Snapshot of who belongs in the room. Class lists are refreshed from Moodle when a teacher opens the page. */
  people: RoomPerson[];
  notes: RoomNote[];
  updatedAt: string;
  /** A meeting's date and time, as YYYY-MM-DDTHH:mm. Class rooms do not have one. */
  startsAt?: string;
}

export interface RoomAccess {
  userId: number;
  isAdmin: boolean;
  /** Courses this person may arrange: they teach or manage them, or they administer the site. */
  staffCourseIds: number[];
  /** Every course they are enrolled in, including ones they teach. */
  enrolledCourseIds: number[];
}

export interface RoomCandidate {
  userId: number;
  name: string;
  courseName: string;
}

export interface PersonSpot {
  personId: string;
  name: string;
  isYou: boolean;
  /** Empty string when a teacher hasn't written a note. Null when this viewer must not see notes. */
  note: string | null;
}

export interface SeatView extends PersonSpot {
  deskId: string;
  x: number;
  y: number;
}

export type UnseatedView = PersonSpot;

export interface RoomView {
  id: string;
  name: string;
  kind: RoomKind;
  courseId: number | null;
  courseName: string | null;
  canEdit: boolean;
  updatedAt: string;
  startsAt: string | null;
  seats: SeatView[];
  unseated: UnseatedView[];
}

export interface RoomCourseOption {
  id: number;
  name: string;
}

export interface RoomPageData {
  canCreate: boolean;
  courses: RoomCourseOption[];
  candidates: RoomCandidate[];
  rooms: RoomView[];
}

export type RoomResult = { ok: true; roomId?: string } | { ok: false; message: string };

/** What the details drawer may show. Email and status stay null for anyone who isn't staff. */
export interface PersonDetails {
  email: string | null;
  /** A teacher may type and save an email for a guest. */
  canEditEmail: boolean;
  courses: { id: number; name: string }[];
  classes: { id: string; name: string }[];
  status: string | null;
  canMessage: boolean;
}

export type PersonLookup = { ok: true; details: PersonDetails } | { ok: false; message: string };

export type RoomMessageResult = { ok: true; message: string } | { ok: false; message: string };

interface NamedUser {
  id: number;
  fullname: string;
  roles?: { shortname: string }[];
}

const COLUMNS = 5;

export function userPersonId(userId: number): string {
  return `user:${userId}`;
}

export function isRecordId(value: string): boolean {
  return /^[A-Za-z0-9-]{1,80}$/.test(value);
}

export function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.round(Math.min(96, Math.max(4, n)) * 10) / 10;
}

// Saved x is the distance from the teacher's left, and y is the distance from the front.
// On the teacher's plan the front is the bottom. A student's plan is that plan turned 180 degrees,
// so the front is at the top and a desk on the teacher's left is on the student's right.
export function spotFromPointer(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  fromTheFront: boolean,
): { x: number; y: number } {
  const across = ((clientX - rect.left) / rect.width) * 100;
  const down = ((clientY - rect.top) / rect.height) * 100;
  return {
    x: clampPercent(fromTheFront ? across : 100 - across),
    y: clampPercent(fromTheFront ? 100 - down : down),
  };
}

/** Where a desk's centre sits on this viewer's plan, as percentages from the top-left of the floor. */
export function planPoint(x: number, y: number, fromTheFront: boolean): { left: number; top: number } {
  return fromTheFront ? { left: x, top: 100 - y } : { left: 100 - x, top: y };
}

/** dx and dy are how far the pointer moved, in percent of the floor: right and down are positive. */
export function draggedSpot(originX: number, originY: number, dx: number, dy: number, fromTheFront: boolean): { x: number; y: number } {
  return {
    x: clampPercent(originX + (fromTheFront ? dx : -dx)),
    y: clampPercent(originY + (fromTheFront ? -dy : dy)),
  };
}

export function gridPosition(index: number): { x: number; y: number } {
  const col = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  return {
    x: clampPercent(12 + col * 19),
    y: clampPercent(16 + row * 15),
  };
}

/** The first grid seat that isn't already occupied, so a new person doesn't land on someone. */
export function freePosition(desks: { x: number; y: number }[]): { x: number; y: number } {
  for (let i = 0; i < ROOM_PEOPLE_MAX; i++) {
    const pos = gridPosition(i);
    const taken = desks.some((d) => Math.hypot(d.x - pos.x, d.y - pos.y) < 10);
    if (!taken) return pos;
  }
  return gridPosition(desks.length);
}

export function desksForPeople(people: RoomPerson[], id: () => string = () => crypto.randomUUID()): Desk[] {
  return people.map((person, index) => ({ id: id(), personId: person.id, ...gridPosition(index) }));
}

export function classPeople(users: NamedUser[], adminIds: ReadonlySet<number>): RoomPerson[] {
  return users
    .filter((person) => !adminIds.has(person.id) && person.roles?.some((role) => role.shortname === 'student'))
    .sort((a, b) => a.fullname.localeCompare(b.fullname, 'en-GB'))
    .map((person) => ({ id: userPersonId(person.id), name: person.fullname, userId: person.id }));
}

export function peopleChanged(before: RoomPerson[], after: RoomPerson[]): boolean {
  if (before.length !== after.length) return true;
  const names = new Map(before.map((person) => [person.id, person.name]));
  return after.some((person) => names.get(person.id) !== person.name);
}

export function canEditRoom(room: RoomRecord, access: RoomAccess): boolean {
  if (room.kind === 'class' && room.courseId !== null) {
    return access.isAdmin || access.staffCourseIds.includes(room.courseId);
  }
  if (room.kind === 'meeting') {
    return access.isAdmin || room.ownerId === access.userId;
  }
  return false;
}

export function canViewRoom(room: RoomRecord, access: RoomAccess): boolean {
  if (canEditRoom(room, access)) return true;
  if (room.kind === 'class' && room.courseId !== null && access.enrolledCourseIds.includes(room.courseId)) return true;
  return room.people.some((person) => person.userId === access.userId);
}

export function cleanLabel(value: string, max: number): { ok: true; value: string } | { ok: false; reason: 'empty' | 'long' } {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return { ok: false, reason: 'empty' };
  if (trimmed.length > max) return { ok: false, reason: 'long' };
  return { ok: true, value: trimmed };
}

/** Empty clears a guest email. Anything else must be an email address. */
export function cleanGuestEmail(value: string): { ok: true; value: string } | { ok: false; reason: 'bad' | 'long' } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: '' };
  if (trimmed.length > GUEST_EMAIL_MAX) return { ok: false, reason: 'long' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { ok: false, reason: 'bad' };
  return { ok: true, value: trimmed };
}

/** A meeting time from a datetime field. The value is the wall-clock time the teacher picked. */
export function cleanStartsAt(value: string): { ok: true; value: string } | { ok: false } {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return { ok: false };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || hour > 23 || minute > 59) return { ok: false };
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return { ok: false };
  return { ok: true, value: `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}` };
}

/** "Tue 27 Oct, 14:30", from a stored meeting time. */
export function roomWhenLabel(startsAt: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(startsAt);
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5])));
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Empty is allowed: it clears the note. */
export function cleanNote(value: string): { ok: true; value: string } | { ok: false } {
  const trimmed = value.trim();
  if (trimmed.length > NOTE_MAX) return { ok: false };
  return { ok: true, value: trimmed };
}

export function pruneRoom(desks: Desk[], notes: RoomNote[], people: RoomPerson[]): { desks: Desk[]; notes: RoomNote[] } {
  const ids = new Set(people.map((person) => person.id));
  return {
    desks: desks.filter((desk) => ids.has(desk.personId)),
    notes: notes.filter((note) => ids.has(note.personId) && note.text.trim()),
  };
}

/** Keeps a layout the browser sent, or returns null when it isn't a layout (so a bad save can't wipe the room). */
export function sanitiseDesks(input: unknown, people: RoomPerson[]): Desk[] | null {
  if (!Array.isArray(input) || input.length > ROOM_PEOPLE_MAX) return null;
  const allowed = new Set(people.map((person) => person.id));
  const seenPerson = new Set<string>();
  const seenId = new Set<string>();
  const desks: Desk[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') return null;
    const desk = item as Record<string, unknown>;
    if (typeof desk.id !== 'string' || !isRecordId(desk.id)) return null;
    if (typeof desk.personId !== 'string' || typeof desk.x !== 'number' || typeof desk.y !== 'number') return null;
    if (!allowed.has(desk.personId)) continue;
    if (seenPerson.has(desk.personId) || seenId.has(desk.id)) return null;
    seenPerson.add(desk.personId);
    seenId.add(desk.id);
    desks.push({ id: desk.id, personId: desk.personId, x: clampPercent(desk.x), y: clampPercent(desk.y) });
  }
  if (desks.length === 0 && input.length > 0) return null;
  return desks;
}

export function toRoomView(room: RoomRecord, viewerId: number, canEdit: boolean, courseName: string | null): RoomView {
  const noteFor = (personId: string): string | null => {
    if (!canEdit) return null;
    return room.notes.find((note) => note.personId === personId)?.text ?? '';
  };
  const spot = (person: RoomPerson): PersonSpot => ({
    personId: person.id,
    name: person.name,
    isYou: person.userId === viewerId,
    note: noteFor(person.id),
  });
  const byId = new Map(room.people.map((person) => [person.id, person]));
  const seated = new Set<string>();
  const seats: SeatView[] = [];
  for (const desk of room.desks) {
    const person = byId.get(desk.personId);
    if (!person || seated.has(person.id)) continue;
    seated.add(person.id);
    seats.push({ ...spot(person), deskId: desk.id, x: desk.x, y: desk.y });
  }
  return {
    id: room.id,
    name: room.name,
    kind: room.kind,
    courseId: room.courseId,
    courseName,
    canEdit,
    updatedAt: room.updatedAt,
    startsAt: room.kind === 'meeting' ? (room.startsAt ?? null) : null,
    seats,
    unseated: room.people.filter((person) => !seated.has(person.id)).map(spot),
  };
}

function samePerson(a: { id: string; userId?: number }, b: { id: string; userId?: number }): boolean {
  if (a.userId !== undefined && b.userId !== undefined) return a.userId === b.userId;
  return a.id === b.id;
}

/** Class rooms this viewer can see that include the person. Meetings are not classes. */
export function classesForPerson(
  rooms: RoomRecord[],
  person: { id: string; userId?: number },
  access: RoomAccess,
): { id: string; name: string }[] {
  return rooms
    .filter((room) => room.kind === 'class' && canViewRoom(room, access) && room.people.some((item) => samePerson(item, person)))
    .map((room) => ({ id: room.id, name: room.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en-GB') || a.id.localeCompare(b.id));
}

/** Course ids of those class rooms, so a shared class still shows when Moodle won't list every course. */
export function sharedClassCourses(
  rooms: RoomRecord[],
  person: { id: string; userId?: number },
  access: RoomAccess,
): number[] {
  const ids = new Set<number>();
  for (const room of rooms) {
    if (room.kind !== 'class' || room.courseId === null || !canViewRoom(room, access)) continue;
    if (room.people.some((item) => samePerson(item, person))) ids.add(room.courseId);
  }
  return [...ids];
}

export function mergeCourses(
  primary: { id: number; name: string }[],
  extra: { id: number; name: string }[],
): { id: number; name: string }[] {
  const byId = new Map<number, string>();
  for (const course of [...primary, ...extra]) {
    if (!byId.has(course.id)) byId.set(course.id, course.name);
  }
  return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'en-GB') || a.id - b.id);
}

function personStatus(lastAccess: number, suspended: boolean, now: number): string {
  if (suspended) return 'Suspended';
  const label = lastVisitLabel(lastAccess, now);
  return label === 'Never' ? 'Never visited' : `Last visit: ${label}`;
}

/** Staff see email and status. Students see courses and classes. Guests and yourself can't be messaged. */
export function personDetailsFor(facts: {
  staff: boolean;
  isYou: boolean;
  hasAccount: boolean;
  email: string;
  courses: { id: number; name: string }[];
  classes: { id: string; name: string }[];
  lastAccess: number;
  suspended: boolean;
  now: number;
}): PersonDetails {
  const courses = facts.courses;
  const classes = facts.classes;
  if (!facts.hasAccount) {
    const email = facts.email.trim();
    return {
      email: facts.staff ? email : null,
      canEditEmail: facts.staff,
      courses,
      classes,
      status: facts.staff ? 'Guest' : null,
      canMessage: false,
    };
  }
  const email = facts.email.trim();
  return {
    email: facts.staff ? (email || 'Not shared') : null,
    canEditEmail: false,
    courses,
    classes,
    status: facts.staff ? personStatus(facts.lastAccess, facts.suspended, facts.now) : null,
    canMessage: !facts.isYou,
  };
}
