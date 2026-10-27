// @vitest-environment node
// The store runs on Postgres; here on PGlite (Postgres inside the test process), which runs the
// same SQL as Neon. The other tests run in jsdom, which can't load it.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openRoomStore, pgliteDb } from './rooms.db';
import type { RoomRecord } from './rooms';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function room(): RoomRecord {
  return {
    id: 'room-1',
    name: 'Tuesday lab',
    kind: 'class',
    courseId: 8,
    ownerId: 2,
    updatedAt: '2026-01-01T00:00:00.000Z',
    people: [
      { id: 'user:5', name: 'Ada Lovelace', userId: 5 },
      { id: 'guest:1', name: 'Mollie', email: 'mollie@example.com' },
    ],
    desks: [
      { id: 'desk-1', personId: 'user:5', x: 12, y: 16 },
      { id: 'desk-2', personId: 'guest:1', x: 69, y: 46.5 },
    ],
    notes: [{ personId: 'user:5', text: 'Sits near the front.', updatedAt: '2026-01-02T00:00:00.000Z' }],
  };
}

function meeting(): RoomRecord {
  return {
    id: 'room-2',
    name: 'Parents evening',
    kind: 'meeting',
    courseId: null,
    ownerId: 2,
    updatedAt: '2026-01-03T00:00:00.000Z',
    startsAt: '2026-11-05T18:30',
    people: [{ id: 'guest:2', name: 'Sam' }],
    desks: [],
    notes: [],
  };
}

describe('room database', () => {
  it('saves the layout and the notes, and reads them back after reopening', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'rooms-'));
    dirs.push(dir);
    const first = await openRoomStore(await pgliteDb(dir));
    expect(await first.ready()).toBe(false);
    expect(await first.read()).toEqual([]);

    const saved = room();
    await first.write([saved]);
    await first.markReady();
    expect(await first.read()).toEqual([saved]);
    expect(await first.ready()).toBe(true);

    // Moodle users' emails are never stored, nor blank guest emails.
    const leaked = room();
    leaked.people = [
      { id: 'user:5', name: 'Ada Lovelace', userId: 5, email: 'ada@example.com' },
      { id: 'guest:1', name: 'Mollie', email: '   ' },
    ];
    await first.write([leaked]);
    expect((await first.read())[0]?.people).toEqual([
      { id: 'user:5', name: 'Ada Lovelace', userId: 5 },
      { id: 'guest:1', name: 'Mollie' },
    ]);
    await first.write([saved, meeting()]);
    await first.close();

    const second = await openRoomStore(await pgliteDb(dir));
    expect(await second.ready()).toBe(true);
    expect(await second.read()).toEqual([saved, meeting()]); // In order, with the meeting's time
    await second.write([]);
    expect(await second.read()).toEqual([]);
    await second.close();
  });

  it('keeps only meetings\' start times', async () => {
    const store = await openRoomStore(await pgliteDb('memory://'));
    await store.write([{ ...room(), startsAt: '2026-11-05T09:00' }]);
    expect((await store.read())[0]).not.toHaveProperty('startsAt');
    await store.close();
  });

  it('runs locked changes one after the other, so neither is lost', async () => {
    const store = await openRoomStore(await pgliteDb('memory://'));
    await store.write([room()]);
    const rename = (name: string) => store.locked(async (tx) => {
      const rooms = await store.read(tx);
      await new Promise((resolve) => setTimeout(resolve, 20)); // Both would read before either writes
      await store.write([...rooms, { ...meeting(), id: `room-${name}`, name }], tx);
    });
    await Promise.all([rename('A'), rename('B')]);
    expect((await store.read()).map((r) => r.name).sort()).toEqual(['A', 'B', 'Tuesday lab']);
    await store.close();
  });

  it('rolls back a locked change that fails', async () => {
    const store = await openRoomStore(await pgliteDb('memory://'));
    await store.write([room()]);
    await expect(store.locked(async (tx) => {
      await store.write([], tx);
      throw new Error('Moodle was down');
    })).rejects.toThrow('Moodle was down');
    expect(await store.read()).toEqual([room()]);
    await store.close();
  });
});
