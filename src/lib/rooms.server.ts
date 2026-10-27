import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';
import { adminUserIds } from './accessRequest.server';
import { decodeEntities } from './entities';
import { MESSAGE_MAX } from './messages';
import type { SessionPayload } from './session';
import { moodle, MoodleError } from './moodle';
import { teachesCourse } from './staff.server';
import type { CourseUser } from './types';
import { openRoomStore, pgliteDb, postgresDb, type RoomStore, type Sql } from './rooms.db';
import { readLegacyRooms } from './rooms.legacy';
import {
  GUEST_EMAIL_MAX,
  GUEST_NAME_MAX,
  LOCATION_MAX,
  NOTE_MAX,
  ROOM_NAME_MAX,
  ROOM_PEOPLE_MAX,
  canEditRoom,
  canViewRoom,
  classPeople,
  classesForPerson,
  cleanGuestEmail,
  cleanLabel,
  cleanLocation,
  cleanNote,
  cleanOptionalStartsAt,
  desksForPeople,
  freePosition,
  mergeCourses,
  peopleChanged,
  personDetailsFor,
  pruneRoom,
  sanitiseDesks,
  sharedClassCourses,
  toRoomView,
  userPersonId,
  isRecordId,
  type PersonLookup,
  type RoomAccess,
  type RoomCandidate,
  type RoomMessageResult,
  type RoomNote,
  type RoomPageData,
  type RoomPerson,
  type RoomRecord,
  type RoomResult,
} from './rooms';

// Moodle has no seating plan. Layouts and notes live in this app's own Postgres database:
// Neon in production (DATABASE_URL, which Vercel's Neon integration sets). Without DATABASE_URL,
// for local work, Postgres runs inside the app (PGlite) and keeps its data in data/pglite;
// ROOMS_PGLITE_DIR changes where ('memory://' for tests). The first time the database is empty,
// plans kept in the older files (data/rooms.db, data/rooms.json) are copied in.
const LEGACY_SQLITE = path.join(process.cwd(), 'data', 'rooms.db');
const LEGACY_JSON = path.join(process.cwd(), 'data', 'rooms.json');

let opening: Promise<RoomStore> | undefined;

function roomsStore(): Promise<RoomStore> {
  if (!opening) {
    opening = (async () => {
      const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
      const db = url
        ? await postgresDb(url)
        : await pgliteDb(process.env.ROOMS_PGLITE_DIR ?? path.join(process.cwd(), 'data', 'pglite'));
      const store = await openRoomStore(db);
      if (!(await store.ready())) {
        await store.locked(async (tx) => {
          const legacy = await readLegacyRooms(LEGACY_SQLITE, LEGACY_JSON, isRoom);
          if ((await store.read(tx)).length === 0 && legacy.length > 0) await store.write(legacy, tx);
          await store.markReady(tx);
        });
      }
      return store;
    })().catch((error: unknown) => {
      opening = undefined;
      throw error;
    });
  }
  return opening;
}

// A change to the rooms reads, edits and saves them in one transaction holding a database lock,
// so two saves (even on different servers) can't overwrite each other. Reads and writes inside
// it use that transaction.
const current = new AsyncLocalStorage<Sql>();

async function withLock<T>(task: () => Promise<T>): Promise<T> {
  const tx = current.getStore();
  if (tx) return task(); // Already inside one
  const store = await roomsStore();
  return store.locked((sql) => current.run(sql, task));
}

function isDesk(value: unknown): value is RoomRecord['desks'][number] {
  if (!value || typeof value !== 'object') return false;
  const desk = value as RoomRecord['desks'][number];
  return typeof desk.id === 'string' && typeof desk.personId === 'string' && typeof desk.x === 'number' && typeof desk.y === 'number';
}

function isPerson(value: unknown): value is RoomPerson {
  if (!value || typeof value !== 'object') return false;
  const person = value as RoomPerson;
  return typeof person.id === 'string' && typeof person.name === 'string';
}

function isNote(value: unknown): value is RoomNote {
  if (!value || typeof value !== 'object') return false;
  const note = value as RoomNote;
  return typeof note.personId === 'string' && typeof note.text === 'string' && typeof note.updatedAt === 'string';
}

function isRoom(value: unknown): value is RoomRecord {
  if (!value || typeof value !== 'object') return false;
  const room = value as RoomRecord;
  return typeof room.id === 'string'
    && typeof room.name === 'string'
    && (room.kind === 'class' || room.kind === 'meeting')
    && (room.courseId === null || typeof room.courseId === 'number')
    && typeof room.ownerId === 'number'
    && Array.isArray(room.desks) && room.desks.every(isDesk)
    && Array.isArray(room.people) && room.people.every(isPerson)
    && Array.isArray(room.notes) && room.notes.every(isNote)
    && typeof room.updatedAt === 'string'
    && (room.startsAt === undefined || typeof room.startsAt === 'string')
    && (room.location === undefined || typeof room.location === 'string');
}

async function readRooms(): Promise<RoomRecord[]> {
  return (await roomsStore()).read(current.getStore());
}

async function writeRooms(rooms: RoomRecord[]): Promise<void> {
  await (await roomsStore()).write(rooms, current.getStore());
}

async function updateRooms(change: (rooms: RoomRecord[]) => Promise<{ rooms: RoomRecord[]; error?: string }>): Promise<RoomResult> {
  return withLock(async () => {
    const rooms = await readRooms();
    const result = await change(rooms);
    if (result.error) return { ok: false, message: result.error };
    await writeRooms(result.rooms);
    return { ok: true };
  });
}

interface AccessContext {
  access: RoomAccess;
  courses: { id: number; name: string }[];
  courseNames: Map<number, string>;
}

async function loadAccess(session: SessionPayload): Promise<AccessContext> {
  const info = await moodle.siteInfo(session.token);
  const enrolled = await moodle.myCourses(session.token, session.userid);
  const isAdmin = info.userissiteadmin === true;
  const teaching = await Promise.all(enrolled.map((course) => teachesCourse(session.token, session.userid, course.id)));
  const staffCourseIds = enrolled.filter((_, index) => isAdmin || teaching[index]).map((course) => course.id);
  const courseNames = new Map(enrolled.map((course) => [course.id, course.fullname]));
  return {
    access: { userId: session.userid, isAdmin, staffCourseIds, enrolledCourseIds: enrolled.map((course) => course.id) },
    courses: enrolled.filter((course) => staffCourseIds.includes(course.id)).map((course) => ({ id: course.id, name: course.fullname })),
    courseNames,
  };
}

async function studentsIn(token: string, courseId: number, admins: ReadonlySet<number>): Promise<RoomPerson[] | null> {
  try {
    const users = await moodle.enrolledUsers(token, courseId);
    return classPeople(users, admins);
  } catch (error) {
    if (error instanceof MoodleError) return null;
    throw error;
  }
}

function sameDesks(before: RoomRecord['desks'], after: RoomRecord['desks']): boolean {
  if (before.length !== after.length) return false;
  const byPerson = new Map(before.map((desk) => [desk.personId, desk]));
  return after.every((desk) => {
    const other = byPerson.get(desk.personId);
    return other !== undefined && other.id === desk.id && other.x === desk.x && other.y === desk.y;
  });
}

function sameNotes(before: RoomNote[], after: RoomNote[]): boolean {
  if (before.length !== after.length) return false;
  const text = new Map(before.map((note) => [note.personId, note.text]));
  return after.every((note) => text.get(note.personId) === note.text);
}

function replaceRoom(rooms: RoomRecord[], room: RoomRecord): RoomRecord[] {
  return rooms.map((item) => (item.id === room.id ? room : item));
}

async function courseName(token: string, courseId: number, known: Map<number, string>): Promise<string | null> {
  const cached = known.get(courseId);
  if (cached) return cached;
  try {
    const course = await moodle.course(token, courseId);
    if (!course) return null;
    known.set(courseId, course.fullname);
    return course.fullname;
  } catch (error) {
    if (error instanceof MoodleError) return null;
    throw error;
  }
}

async function candidatesFor(token: string, viewerId: number, courses: { id: number; name: string }[], admins: ReadonlySet<number>): Promise<RoomCandidate[]> {
  const byUser = new Map<number, RoomCandidate>();
  await Promise.all(courses.map(async (course) => {
    let users: CourseUser[] = [];
    try {
      users = await moodle.enrolledUsers(token, course.id);
    } catch (error) {
      if (error instanceof MoodleError) return;
      throw error;
    }
    for (const person of users) {
      if (person.id === viewerId || admins.has(person.id)) continue;
      const existing = byUser.get(person.id);
      if (existing) {
        if (!existing.courseName.split(', ').includes(course.name)) existing.courseName = `${existing.courseName}, ${course.name}`;
      } else {
        byUser.set(person.id, { userId: person.id, name: person.fullname, courseName: course.name });
      }
    }
  }));
  return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name, 'en-GB') || a.courseName.localeCompare(b.courseName, 'en-GB'));
}

export async function loadRoomPage(session: SessionPayload): Promise<RoomPageData> {
  const { access, courses, courseNames } = await loadAccess(session);
  const admins = adminUserIds();
  const current = await readRooms();
  const refreshIds = [...new Set(current.flatMap((room) => (
    room.kind === 'class' && room.courseId !== null && canEditRoom(room, access) ? [room.courseId] : []
  )))];
  const live = new Map<number, RoomPerson[]>();
  await Promise.all(refreshIds.map(async (courseId) => {
    const people = await studentsIn(session.token, courseId, admins);
    if (people) live.set(courseId, people);
  }));

  const rooms = await withLock(async () => {
    const latest = await readRooms();
    let dirty = false;
    const next = latest.map((room) => {
      if (room.kind !== 'class' || room.courseId === null || !canEditRoom(room, access)) return room;
      const people = live.get(room.courseId);
      if (!people) return room;
      const pruned = pruneRoom(room.desks, room.notes, people);
      if (!peopleChanged(room.people, people) && sameDesks(room.desks, pruned.desks) && sameNotes(room.notes, pruned.notes)) return room;
      dirty = true;
      return { ...room, people, desks: pruned.desks, notes: pruned.notes, updatedAt: new Date().toISOString() };
    });
    if (dirty) await writeRooms(next);
    return next;
  });

  const visible = rooms.filter((room) => canViewRoom(room, access));
  const views = await Promise.all(visible.map(async (room) => toRoomView(
    room,
    access.userId,
    canEditRoom(room, access),
    room.courseId === null ? null : await courseName(session.token, room.courseId, courseNames),
  )));
  views.sort((a, b) => a.name.localeCompare(b.name, 'en-GB') || a.id.localeCompare(b.id));

  const canCreate = access.isAdmin || access.staffCourseIds.length > 0;
  return {
    canCreate,
    courses,
    candidates: canCreate ? await candidatesFor(session.token, access.userId, courses, admins) : [],
    rooms: views,
  };
}

async function editableRoom(session: SessionPayload, roomId: string): Promise<{ access: RoomAccess; room: RoomRecord; people: RoomPerson[] } | RoomResult> {
  if (!isRecordId(roomId)) return { ok: false, message: 'That room no longer exists.' };
  const { access } = await loadAccess(session);
  const room = (await readRooms()).find((item) => item.id === roomId);
  if (!room || !canEditRoom(room, access)) return { ok: false, message: "You can't change this room." };
  if (room.kind === 'meeting') return { access, room, people: room.people };
  if (room.courseId === null) return { ok: false, message: "You can't change this room." };
  const people = await studentsIn(session.token, room.courseId, adminUserIds());
  if (!people) return { ok: false, message: "The class list couldn't be loaded, so the room wasn't changed." };
  return { access, room, people };
}

function denied(result: { access: RoomAccess; room: RoomRecord; people: RoomPerson[] } | RoomResult): result is RoomResult {
  return 'ok' in result;
}

export async function createRoomRecord(session: SessionPayload, input: { name: string; kind: string; courseId?: number; startsAt?: string; location?: string }): Promise<RoomResult> {
  const { access } = await loadAccess(session);
  if (!access.isAdmin && access.staffCourseIds.length === 0) {
    return { ok: false, message: 'Only teachers can arrange a room.' };
  }
  const name = cleanLabel(input.name, ROOM_NAME_MAX);
  if (!name.ok) {
    return { ok: false, message: name.reason === 'empty' ? 'Give the room a name.' : `Use a shorter name (${ROOM_NAME_MAX} characters or fewer).` };
  }
  if (input.kind !== 'class' && input.kind !== 'meeting') {
    return { ok: false, message: 'Choose a class or a meeting.' };
  }

  let people: RoomPerson[] = [];
  let courseId: number | null = null;
  if (input.kind === 'class') {
    if (!access.staffCourseIds.includes(Number(input.courseId))) {
      return { ok: false, message: 'Choose a class you teach.' };
    }
    courseId = Number(input.courseId);
    const listed = await studentsIn(session.token, courseId, adminUserIds());
    if (!listed) return { ok: false, message: "That class list couldn't be loaded." };
    if (listed.length > ROOM_PEOPLE_MAX) return { ok: false, message: `A room can hold ${ROOM_PEOPLE_MAX} people. This class has more.` };
    people = listed;
  }
  const when = cleanOptionalStartsAt(input.startsAt ?? '');
  if (!when.ok) return { ok: false, message: 'That date or time is not valid.' };
  const place = cleanLocation(input.location ?? '');
  if (!place.ok) return { ok: false, message: `Use a shorter location (${LOCATION_MAX} characters or fewer).` };

  const room: RoomRecord = {
    id: crypto.randomUUID(),
    name: name.value,
    kind: input.kind,
    courseId,
    ownerId: session.userid,
    people,
    desks: desksForPeople(people),
    notes: [],
    updatedAt: new Date().toISOString(),
    ...(when.value ? { startsAt: when.value } : {}),
    ...(place.value ? { location: place.value } : {}),
  };
  const saved = await updateRooms(async (rooms) => ({ rooms: [...rooms, room] }));
  return saved.ok ? { ok: true, roomId: room.id } : saved;
}

export async function updateRoomDetailsRecord(session: SessionPayload, roomId: string, input: { name: string; startsAt?: string; location?: string }): Promise<RoomResult> {
  const found = await editableRoom(session, roomId);
  if (denied(found)) return found;
  const name = cleanLabel(input.name, ROOM_NAME_MAX);
  if (!name.ok) {
    return { ok: false, message: name.reason === 'empty' ? 'Give the room a name.' : `Use a shorter name (${ROOM_NAME_MAX} characters or fewer).` };
  }
  const when = cleanOptionalStartsAt(input.startsAt ?? '');
  if (!when.ok) return { ok: false, message: 'That date or time is not valid.' };
  const place = cleanLocation(input.location ?? '');
  if (!place.ok) return { ok: false, message: `Use a shorter location (${LOCATION_MAX} characters or fewer).` };

  return updateRooms(async (rooms) => {
    const room = rooms.find((item) => item.id === roomId);
    if (!room || !canEditRoom(room, found.access)) return { rooms, error: "You can't change this room." };
    const people = room.kind === 'class' ? found.people : room.people;
    const pruned = pruneRoom(room.desks, room.notes, people);
    const updated: RoomRecord = {
      ...room,
      name: name.value,
      people,
      desks: pruned.desks,
      notes: pruned.notes,
      updatedAt: new Date().toISOString(),
    };
    if (when.value) updated.startsAt = when.value;
    else delete updated.startsAt;
    if (place.value) updated.location = place.value;
    else delete updated.location;
    return { rooms: replaceRoom(rooms, updated) };
  });
}

export async function saveRoomDesks(session: SessionPayload, roomId: string, desks: unknown): Promise<RoomResult> {
  const found = await editableRoom(session, roomId);
  if (denied(found)) return found;
  const clean = sanitiseDesks(desks, found.people);
  if (!clean) return { ok: false, message: "That layout couldn't be saved." };
  return updateRooms(async (rooms) => {
    const room = rooms.find((item) => item.id === roomId);
    if (!room || !canEditRoom(room, found.access)) return { rooms, error: "You can't change this room." };
    const people = room.kind === 'class' ? found.people : room.people;
    const nextDesks = sanitiseDesks(desks, people);
    if (!nextDesks) return { rooms, error: "That layout couldn't be saved." };
    const notes = pruneRoom(nextDesks, room.notes, people).notes;
    const updated: RoomRecord = { ...room, people, desks: nextDesks, notes, updatedAt: new Date().toISOString() };
    return { rooms: replaceRoom(rooms, updated) };
  });
}

export async function saveRoomNote(session: SessionPayload, roomId: string, personId: string, text: string): Promise<RoomResult> {
  const found = await editableRoom(session, roomId);
  if (denied(found)) return found;
  if (!found.people.some((person) => person.id === personId)) {
    return { ok: false, message: "That person isn't in this room." };
  }
  const note = cleanNote(text);
  if (!note.ok) return { ok: false, message: `Keep the note to ${NOTE_MAX} characters or fewer.` };
  return updateRooms(async (rooms) => {
    const room = rooms.find((item) => item.id === roomId);
    if (!room || !canEditRoom(room, found.access)) return { rooms, error: "You can't change this room." };
    const people = room.kind === 'class' ? found.people : room.people;
    if (!people.some((person) => person.id === personId)) return { rooms, error: "That person isn't in this room." };
    const notes = room.notes.filter((item) => item.personId !== personId);
    if (note.value) notes.push({ personId, text: note.value, updatedAt: new Date().toISOString() });
    const pruned = pruneRoom(room.desks, notes, people);
    return { rooms: replaceRoom(rooms, { ...room, people, desks: pruned.desks, notes: pruned.notes, updatedAt: new Date().toISOString() }) };
  });
}

export async function saveGuestEmailRecord(session: SessionPayload, roomId: string, personId: string, email: string): Promise<RoomResult> {
  const found = await editableRoom(session, roomId);
  if (denied(found)) return found;
  if (found.room.kind !== 'meeting') return { ok: false, message: 'Email for someone in a class comes from their account.' };
  const person = found.people.find((item) => item.id === personId);
  if (!person) return { ok: false, message: "That person isn't in this room." };
  if (person.userId !== undefined) return { ok: false, message: 'Email for someone with an account comes from their account.' };
  const clean = cleanGuestEmail(email);
  if (!clean.ok) {
    return { ok: false, message: clean.reason === 'long' ? `Use a shorter email (${GUEST_EMAIL_MAX} characters or fewer).` : 'Enter an email address, like name@example.com.' };
  }
  return updateRooms(async (rooms) => {
    const room = rooms.find((item) => item.id === roomId);
    if (!room || room.kind !== 'meeting' || !canEditRoom(room, found.access)) return { rooms, error: "You can't change this room." };
    if (!room.people.some((item) => item.id === personId && item.userId === undefined)) {
      return { rooms, error: "That person isn't a guest in this room." };
    }
    const people = room.people.map((item) => {
      if (item.id !== personId) return item;
      const next = { ...item };
      if (clean.value) next.email = clean.value;
      else delete next.email;
      return next;
    });
    return { rooms: replaceRoom(rooms, { ...room, people, updatedAt: new Date().toISOString() }) };
  });
}

export async function addMeetingPerson(session: SessionPayload, roomId: string, input: { userId?: number; name?: string }): Promise<RoomResult> {
  const found = await editableRoom(session, roomId);
  if (denied(found)) return found;
  if (found.room.kind !== 'meeting') return { ok: false, message: 'People in a class come from the class list.' };
  if (found.room.people.length >= ROOM_PEOPLE_MAX) return { ok: false, message: `This room already has ${ROOM_PEOPLE_MAX} people.` };

  let person: RoomPerson;
  if (typeof input.userId === 'number' && Number.isInteger(input.userId)) {
    const admins = adminUserIds();
    let enrolled: CourseUser | undefined;
    for (const courseId of found.access.staffCourseIds) {
      try {
        const users = await moodle.enrolledUsers(session.token, courseId);
        enrolled = users.find((user) => user.id === input.userId && !admins.has(user.id));
        if (enrolled) break;
      } catch (error) {
        if (error instanceof MoodleError) continue;
        throw error;
      }
    }
    if (!enrolled) return { ok: false, message: 'Choose someone from a class you teach.' };
    person = { id: userPersonId(enrolled.id), name: enrolled.fullname, userId: enrolled.id };
  } else {
    const name = cleanLabel(input.name ?? '', GUEST_NAME_MAX);
    if (!name.ok) {
      return { ok: false, message: name.reason === 'empty' ? 'Type a name to add.' : `Use a shorter name (${GUEST_NAME_MAX} characters or fewer).` };
    }
    person = { id: `guest:${crypto.randomUUID()}`, name: name.value };
  }

  return updateRooms(async (rooms) => {
    const room = rooms.find((item) => item.id === roomId);
    if (!room || room.kind !== 'meeting' || !canEditRoom(room, found.access)) return { rooms, error: "You can't change this room." };
    if (room.people.length >= ROOM_PEOPLE_MAX) return { rooms, error: `This room already has ${ROOM_PEOPLE_MAX} people.` };
    if (person.userId !== undefined && room.people.some((item) => item.userId === person.userId)) {
      return { rooms, error: `${person.name} is already in this room.` };
    }
    if (person.userId === undefined && room.people.some((item) => item.name.toLocaleLowerCase('en-GB') === person.name.toLocaleLowerCase('en-GB'))) {
      return { rooms, error: `${person.name} is already in this room.` };
    }
    const people = [...room.people, person].sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));
    const desks = [...room.desks, { id: crypto.randomUUID(), personId: person.id, ...freePosition(room.desks) }];
    return { rooms: replaceRoom(rooms, { ...room, people, desks, updatedAt: new Date().toISOString() }) };
  });
}

export async function removeMeetingPerson(session: SessionPayload, roomId: string, personId: string): Promise<RoomResult> {
  const found = await editableRoom(session, roomId);
  if (denied(found)) return found;
  if (found.room.kind !== 'meeting') return { ok: false, message: 'Unseat a student to take them off the plan. They stay in the class.' };
  return updateRooms(async (rooms) => {
    const room = rooms.find((item) => item.id === roomId);
    if (!room || room.kind !== 'meeting' || !canEditRoom(room, found.access)) return { rooms, error: "You can't change this room." };
    if (!room.people.some((person) => person.id === personId)) return { rooms, error: "That person isn't in this room." };
    return {
      rooms: replaceRoom(rooms, {
        ...room,
        people: room.people.filter((person) => person.id !== personId),
        desks: room.desks.filter((desk) => desk.personId !== personId),
        notes: room.notes.filter((note) => note.personId !== personId),
        updatedAt: new Date().toISOString(),
      }),
    };
  });
}

interface FoundPerson {
  access: RoomAccess;
  room: RoomRecord;
  person: RoomPerson;
  rooms: RoomRecord[];
  courseNames: Map<number, string>;
}

async function viewablePerson(session: SessionPayload, roomId: string, personId: string): Promise<FoundPerson | { ok: false; message: string }> {
  if (!isRecordId(roomId) || !personId) return { ok: false, message: "That person isn't in this room." };
  const { access, courseNames } = await loadAccess(session);
  const rooms = await readRooms();
  const room = rooms.find((item) => item.id === roomId);
  if (!room || !canViewRoom(room, access)) return { ok: false, message: "You can't open this room." };
  const person = room.people.find((item) => item.id === personId);
  if (!person) return { ok: false, message: "That person isn't in this room." };
  return { access, room, person, rooms, courseNames };
}

function missingPerson(found: FoundPerson | { ok: false; message: string }): found is { ok: false; message: string } {
  return 'ok' in found;
}

// Loaded when the drawer opens, so a student's page never includes someone else's email.
// Staff see email and status. Courses come from Moodle, plus any classroom both people can see.
export async function loadPersonDetails(session: SessionPayload, roomId: string, personId: string): Promise<PersonLookup> {
  const found = await viewablePerson(session, roomId, personId);
  if (missingPerson(found)) return found;
  const staff = found.access.isAdmin || found.access.staffCourseIds.length > 0;
  const userId = found.person.userId;
  const hasAccount = userId !== undefined;

  let email = '';
  let lastAccess = 0;
  let suspended = false;
  let listed: { id: number; name: string }[] = [];
  if (hasAccount && userId !== undefined) {
    const [profile, courses] = await Promise.all([
      staff ? profileOf(session.token, userId) : Promise.resolve(null),
      coursesOf(session.token, userId),
    ]);
    if (profile) {
      email = profile.email;
      lastAccess = profile.lastAccess;
      suspended = profile.suspended;
    }
    listed = courses;
    if (staff && lastAccess === 0 && found.room.kind === 'class' && found.room.courseId !== null) {
      lastAccess = await courseVisit(session.token, found.room.courseId, userId);
    }
  } else if (staff) {
    email = found.person.email ?? '';
  }

  const sharedIds = sharedClassCourses(found.rooms, found.person, found.access);
  const shared = await Promise.all(sharedIds.map(async (id) => ({
    id,
    name: found.courseNames.get(id) ?? await courseName(session.token, id, found.courseNames) ?? 'Course',
  })));

  return {
    ok: true,
    details: personDetailsFor({
      staff,
      isYou: userId === session.userid,
      hasAccount,
      email,
      courses: mergeCourses(listed, shared),
      classes: classesForPerson(found.rooms, found.person, found.access),
      lastAccess,
      suspended,
      now: Math.floor(Date.now() / 1000),
    }),
  };
}

async function profileOf(token: string, userId: number): Promise<{ email: string; lastAccess: number; suspended: boolean } | null> {
  try {
    const user = await moodle.userById(token, userId);
    if (!user) return { email: '', lastAccess: 0, suspended: false };
    return {
      email: decodeEntities(user.email ?? ''),
      lastAccess: user.lastaccess ?? 0,
      suspended: user.suspended === true || user.suspended === 1,
    };
  } catch (error) {
    if (error instanceof MoodleError) return null;
    throw error;
  }
}

async function coursesOf(token: string, userId: number): Promise<{ id: number; name: string }[]> {
  try {
    const courses = await moodle.myCourses(token, userId);
    return courses.map((course) => ({ id: course.id, name: course.fullname }));
  } catch (error) {
    if (error instanceof MoodleError) return [];
    throw error;
  }
}

async function courseVisit(token: string, courseId: number, userId: number): Promise<number> {
  try {
    const users = await moodle.enrolledUsers(token, courseId);
    return users.find((user) => user.id === userId)?.lastcourseaccess ?? 0;
  } catch (error) {
    if (error instanceof MoodleError) return 0;
    throw error;
  }
}

// Either person in a room they can both open may write. The message goes through Moodle.
export async function messageRoomPerson(session: SessionPayload, roomId: string, personId: string, text: string): Promise<RoomMessageResult> {
  const found = await viewablePerson(session, roomId, personId);
  if (missingPerson(found)) return found;
  if (found.person.userId === undefined) {
    return { ok: false, message: "This person doesn't have an account, so they can't get a message." };
  }
  if (found.person.userId === session.userid) return { ok: false, message: "You can't message yourself." };
  const body = text.trim();
  if (!body) return { ok: false, message: 'Write a message first.' };
  if (body.length > MESSAGE_MAX) return { ok: false, message: `Keep the message to ${MESSAGE_MAX} characters or fewer.` };
  try {
    await moodle.sendMessage(session.token, found.person.userId, body);
  } catch (error) {
    if (error instanceof MoodleError) return { ok: false, message: `The message couldn't be sent: ${error.message}` };
    throw error;
  }
  return { ok: true, message: `Message sent to ${found.person.name}.` };
}

export async function deleteRoomRecord(session: SessionPayload, roomId: string): Promise<RoomResult> {
  const found = await editableRoom(session, roomId);
  if (denied(found)) return found;
  return updateRooms(async (rooms) => {
    const room = rooms.find((item) => item.id === roomId);
    if (!room || !canEditRoom(room, found.access)) return { rooms, error: "You can't change this room." };
    return { rooms: rooms.filter((item) => item.id !== roomId) };
  });
}
