import 'server-only';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { RoomRecord } from './rooms';

// Before Postgres, plans were kept in data/rooms.db (SQLite) and, before that, data/rooms.json.
// The first time the Postgres store starts empty, whatever is in those files is copied in, so
// nothing set up locally is lost. On Vercel there are no such files, so this does nothing there.

export async function readLegacyRooms(sqliteFile: string, jsonFile: string, isRoom: (value: unknown) => value is RoomRecord): Promise<RoomRecord[]> {
  if (existsSync(sqliteFile)) return readSqlite(sqliteFile);
  try {
    const parsed: unknown = JSON.parse(await readFile(jsonFile, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { rooms?: unknown }).rooms)) return [];
    return (parsed as { rooms: unknown[] }).rooms.filter(isRoom);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

type Row = Record<string, unknown>;

async function readSqlite(file: string): Promise<RoomRecord[]> {
  const { DatabaseSync } = await import('node:sqlite'); // Only loaded when the old file is there
  const db = new DatabaseSync(file);
  try {
    const cols = (table: string) => new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => String(c.name)));
    const roomCols = cols('rooms');
    const peopleCols = cols('room_people');
    const rooms = db.prepare(`SELECT * FROM rooms ORDER BY rowid`).all();
    const people = db.prepare(`SELECT * FROM room_people ORDER BY rowid`).all();
    const desks = db.prepare(`SELECT * FROM room_desks ORDER BY rowid`).all();
    const notes = db.prepare(`SELECT * FROM room_notes ORDER BY rowid`).all();
    const of = (rows: Row[], id: string) => rows.filter((r) => r.room_id === id);
    return rooms.map((r): RoomRecord => {
      const id = String(r.id);
      return {
        id,
        name: String(r.name),
        kind: r.kind === 'meeting' ? 'meeting' : 'class',
        courseId: r.course_id === null || r.course_id === undefined ? null : Number(r.course_id),
        ownerId: Number(r.owner_id),
        updatedAt: String(r.updated_at),
        ...(roomCols.has('starts_at') && typeof r.starts_at === 'string' && r.starts_at ? { startsAt: r.starts_at } : {}),
        ...(roomCols.has('location') && typeof r.location === 'string' && r.location.trim() ? { location: r.location } : {}),
        people: of(people, id).map((p) => ({
          id: String(p.id),
          name: String(p.name),
          ...(p.user_id !== null && p.user_id !== undefined ? { userId: Number(p.user_id) } : {}),
          ...(peopleCols.has('email') && typeof p.email === 'string' && p.email.trim() ? { email: p.email } : {}),
        })),
        desks: of(desks, id).map((d) => ({ id: String(d.id), personId: String(d.person_id), x: Number(d.x), y: Number(d.y) })),
        notes: of(notes, id).map((n) => ({ personId: String(n.person_id), text: String(n.text), updatedAt: String(n.updated_at) })),
      };
    });
  } finally {
    db.close();
  }
}
