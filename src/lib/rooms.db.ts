import type { RoomNote, RoomPerson, RoomRecord } from './rooms';

// Seating plans are not part of Moodle, so this app keeps them in its own Postgres database
// (Neon in production): the room, who is in it, where each desk sits, and the teacher's notes.
// The SQL here is plain Postgres; `Sql` is the small part of a client it needs, so the same code
// runs on Neon (node-postgres) and, for local work and tests, on PGlite (Postgres in-process).

export interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export interface Db extends Sql {
  /** Runs `work` in one transaction: committed if it finishes, rolled back if it throws. */
  transaction<T>(work: (tx: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// One statement each, so any client can run them. IF NOT EXISTS keeps it safe to run every start.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('class', 'meeting')),
    course_id INTEGER,
    owner_id INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    starts_at TEXT,
    sort INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS room_people (
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    user_id INTEGER,
    email TEXT,
    sort INTEGER NOT NULL,
    PRIMARY KEY (room_id, id)
  )`,
  `CREATE TABLE IF NOT EXISTS room_desks (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL,
    x DOUBLE PRECISION NOT NULL,
    y DOUBLE PRECISION NOT NULL,
    sort INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS room_notes (
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL,
    text TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sort INTEGER NOT NULL,
    PRIMARY KEY (room_id, person_id)
  )`,
  `CREATE TABLE IF NOT EXISTS store_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

// Any fixed number: every save takes this lock first, so two saves (even from different servers)
// happen one after the other instead of overwriting each other.
const ROOMS_LOCK = 72_510_001;

export interface RoomStore {
  read(sql?: Sql): Promise<RoomRecord[]>;
  write(rooms: RoomRecord[], sql?: Sql): Promise<void>;
  /** Runs `work` in a transaction holding the rooms lock; pass `tx` to read() and write() inside. */
  locked<T>(work: (tx: Sql) => Promise<T>): Promise<T>;
  ready(): Promise<boolean>;
  markReady(sql?: Sql): Promise<void>;
  close(): Promise<void>;
}

export async function openRoomStore(db: Db): Promise<RoomStore> {
  for (const statement of SCHEMA) await db.query(statement);

  const store: RoomStore = {
    async read(sql: Sql = db) {
      const [rooms, people, desks, notes] = await Promise.all([
        sql.query('SELECT id, name, kind, course_id, owner_id, updated_at, starts_at FROM rooms ORDER BY sort'),
        sql.query('SELECT room_id, id, name, user_id, email FROM room_people ORDER BY room_id, sort'),
        sql.query('SELECT id, room_id, person_id, x, y FROM room_desks ORDER BY room_id, sort'),
        sql.query('SELECT room_id, person_id, text, updated_at FROM room_notes ORDER BY room_id, sort'),
      ]);
      const peopleBy = group(people.rows, 'room_id');
      const desksBy = group(desks.rows, 'room_id');
      const notesBy = group(notes.rows, 'room_id');
      return rooms.rows.map((row): RoomRecord => {
        const id = text(row.id);
        return {
          id,
          name: text(row.name),
          kind: row.kind === 'meeting' ? 'meeting' : 'class',
          courseId: row.course_id === null || row.course_id === undefined ? null : number(row.course_id),
          ownerId: number(row.owner_id),
          updatedAt: text(row.updated_at),
          ...(typeof row.starts_at === 'string' && row.starts_at ? { startsAt: row.starts_at } : {}),
          people: (peopleBy.get(id) ?? []).map(personFrom),
          desks: (desksBy.get(id) ?? []).map(deskFrom),
          notes: (notesBy.get(id) ?? []).map(noteFrom),
        };
      });
    },

    // Replaces everything, as the app saves the whole list. Inside locked(), or in its own transaction.
    async write(rooms, sql) {
      const run = async (tx: Sql) => {
        await tx.query('DELETE FROM rooms'); // People, desks and notes go with their room (ON DELETE CASCADE).
        for (const [i, room] of rooms.entries()) {
          await tx.query(
            'INSERT INTO rooms (id, name, kind, course_id, owner_id, updated_at, starts_at, sort) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [room.id, room.name, room.kind, room.courseId, room.ownerId, room.updatedAt, meetingTime(room), i],
          );
          for (const [j, person] of room.people.entries()) {
            await tx.query('INSERT INTO room_people (room_id, id, name, user_id, email, sort) VALUES ($1, $2, $3, $4, $5, $6)',
              [room.id, person.id, person.name, person.userId ?? null, guestEmail(person), j]);
          }
          for (const [j, desk] of room.desks.entries()) {
            await tx.query('INSERT INTO room_desks (id, room_id, person_id, x, y, sort) VALUES ($1, $2, $3, $4, $5, $6)',
              [desk.id, room.id, desk.personId, desk.x, desk.y, j]);
          }
          for (const [j, note] of room.notes.entries()) {
            await tx.query('INSERT INTO room_notes (room_id, person_id, text, updated_at, sort) VALUES ($1, $2, $3, $4, $5)',
              [room.id, note.personId, note.text, note.updatedAt, j]);
          }
        }
      };
      if (sql) await run(sql);
      else await store.locked(run);
    },

    locked(work) {
      return db.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock($1)', [ROOMS_LOCK]); // Released at commit or rollback
        return work(tx);
      });
    },

    async ready() {
      const { rows } = await db.query<{ value: string }>("SELECT value FROM store_meta WHERE key = 'ready'");
      return rows[0]?.value === '1';
    },

    async markReady(sql: Sql = db) {
      await sql.query("INSERT INTO store_meta (key, value) VALUES ('ready', '1') ON CONFLICT (key) DO UPDATE SET value = '1'");
    },

    close() {
      return db.close();
    },
  };
  return store;
}

// Neon (or any Postgres) by connection string.
export async function postgresDb(connectionString: string): Promise<Db> {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, max: 3 });
  return {
    query: (text, params) => pool.query(text, params) as never,
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work({ query: (text, params) => client.query(text, params) as never });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

// Postgres running inside this process, for when there's no DATABASE_URL: a folder on disk for
// local work, or 'memory://' for tests.
export async function pgliteDb(dataDir: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite(dataDir);
  return {
    query: (text, params) => pg.query(text, params) as never,
    transaction: (work) => pg.transaction((tx) => work({ query: (text, params) => tx.query(text, params) as never })),
    close: () => pg.close(),
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

function meetingTime(room: RoomRecord): string | null {
  if (room.kind !== 'meeting') return null;
  const when = room.startsAt?.trim();
  return when ? when : null;
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
