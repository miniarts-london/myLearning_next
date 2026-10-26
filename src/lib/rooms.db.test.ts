import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openRoomStore } from './rooms.db';
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

describe('room database', () => {
  it('saves the layout and the notes, and reads them back', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'rooms-'));
    dirs.push(dir);
    const file = path.join(dir, 'rooms.db');
    const first = openRoomStore(file);
    expect(first.ready()).toBe(false);
    expect(first.read()).toEqual([]);

    const saved = room();
    first.write([saved]);
    first.markReady();
    expect(first.read()).toEqual([saved]);
    expect(first.ready()).toBe(true);

    const leaked = room();
    leaked.people = [
      { id: 'user:5', name: 'Ada Lovelace', userId: 5, email: 'ada@example.com' },
      { id: 'guest:1', name: 'Mollie', email: '   ' },
    ];
    first.write([leaked]);
    expect(first.read()[0]?.people).toEqual([
      { id: 'user:5', name: 'Ada Lovelace', userId: 5 },
      { id: 'guest:1', name: 'Mollie' },
    ]);
    first.write([saved]);
    first.close();

    const second = openRoomStore(file);
    expect(second.ready()).toBe(true);
    expect(second.read()).toEqual([saved]);
    second.write([]);
    expect(second.read()).toEqual([]);
    second.close();
  });
});
