import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { RoomNote, RoomPerson, RoomRecord } from './rooms';

// Seating plans are not part of Moodle, so this app keeps them in its own database:
// the room, who is in it, where each desk sits, and the teacher's notes.

const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('class', 'meeting')),
  course_id INTEGER,
  owner_id INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS room_people (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  user_id INTEGER,
  email TEXT,
  PRIMARY KEY (room_id, id)
);
CREATE TABLE IF NOT EXISTS room_desks (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS room_notes (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL,
  text TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (room_id, person_id)
);
CREATE TABLE IF NOT EXISTS store_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export interface RoomStore {
  read(): RoomRecord[];
  write(rooms: RoomRecord[]): void;
  ready(): boolean;
  markReady(): void;
  close(): void;
}

export function openRoomStore(file: string): RoomStore {
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  db.exec('PRAGMA journal_mode = WAL');
  const columns = db.prepare('PRAGMA table_info(room_people)').all();
  if (!columns.some((column) => column.name === 'email')) {
    db.exec('ALTER TABLE room_people ADD COLUMN email TEXT');
  }

  const insertRoom = db.prepare(`INSERT INTO rooms (id, name, kind, course_id, owner_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)`);
  const insertPerson = db.prepare(`INSERT INTO room_people (room_id, id, name, user_id, email) VALUES (?, ?, ?, ?, ?)`);
  const insertDesk = db.prepare(`INSERT INTO room_desks (id, room_id, person_id, x, y) VALUES (?, ?, ?, ?, ?)`);
  const insertNote = db.prepare(`INSERT INTO room_notes (room_id, person_id, text, updated_at) VALUES (?, ?, ?, ?)`);
  const roomsQuery = db.prepare(`SELECT id, name, kind, course_id, owner_id, updated_at FROM rooms ORDER BY rowid`);
  const peopleQuery = db.prepare(`SELECT room_id, id, name, user_id, email FROM room_people ORDER BY rowid`);
  const desksQuery = db.prepare(`SELECT id, room_id, person_id, x, y FROM room_desks ORDER BY rowid`);
  const notesQuery = db.prepare(`SELECT room_id, person_id, text, updated_at FROM room_notes ORDER BY rowid`);
  const readyQuery = db.prepare(`SELECT value FROM store_meta WHERE key = 'ready'`);
  const markReadyQuery = db.prepare(`INSERT INTO store_meta (key, value) VALUES ('ready', '1') ON CONFLICT(key) DO UPDATE SET value = '1'`);

  return {
    read() {
      const people = group(peopleQuery.all(), 'room_id');
      const desks = group(desksQuery.all(), 'room_id');
      const notes = group(notesQuery.all(), 'room_id');
      return roomsQuery.all().map((row) => {
        const id = text(row.id);
        return {
          id,
          name: text(row.name),
          kind: row.kind === 'meeting' ? 'meeting' : 'class',
          courseId: row.course_id === null || row.course_id === undefined ? null : number(row.course_id),
          ownerId: number(row.owner_id),
          updatedAt: text(row.updated_at),
          people: (people.get(id) ?? []).map(personFrom),
          desks: (desks.get(id) ?? []).map(deskFrom),
          notes: (notes.get(id) ?? []).map(noteFrom),
        };
      });
    },
    write(rooms) {
      db.exec('BEGIN IMMEDIATE');
      try {
        db.exec('DELETE FROM room_notes');
        db.exec('DELETE FROM room_desks');
        db.exec('DELETE FROM room_people');
        db.exec('DELETE FROM rooms');
        for (const room of rooms) {
          insertRoom.run(room.id, room.name, room.kind, room.courseId, room.ownerId, room.updatedAt);
          for (const person of room.people) insertPerson.run(room.id, person.id, person.name, person.userId ?? null, guestEmail(person));
          for (const desk of room.desks) insertDesk.run(desk.id, room.id, desk.personId, desk.x, desk.y);
          for (const note of room.notes) insertNote.run(room.id, note.personId, note.text, note.updatedAt);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    ready() {
      return readyQuery.get()?.value === '1';
    },
    markReady() {
      markReadyQuery.run();
    },
    close() {
      db.close();
    },
  };
}

function group(rows: Record<string, unknown>[], key: string): Map<string, Record<string, unknown>[]> {
  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const id = text(row[key]);
    const list = grouped.get(id);
    if (list) list.push(row);
    else grouped.set(id, [row]);
  }
  return grouped;
}

function personFrom(row: Record<string, unknown>): RoomPerson {
  const person: RoomPerson = { id: text(row.id), name: text(row.name) };
  if (row.user_id !== null && row.user_id !== undefined) person.userId = number(row.user_id);
  if (typeof row.email === 'string' && row.email.trim()) person.email = row.email;
  return person;
}

function guestEmail(person: RoomPerson): string | null {
  if (person.userId !== undefined) return null;
  const email = person.email?.trim();
  return email ? email : null;
}

function deskFrom(row: Record<string, unknown>): RoomRecord['desks'][number] {
  return { id: text(row.id), personId: text(row.person_id), x: number(row.x), y: number(row.y) };
}

function noteFrom(row: Record<string, unknown>): RoomNote {
  return { personId: text(row.person_id), text: text(row.text), updatedAt: text(row.updated_at) };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function number(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}
