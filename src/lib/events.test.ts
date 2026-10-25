import { describe, expect, it } from 'vitest';
import { toEvents } from './events';
import type { CalendarEvent } from './types';

const NOW = 1_800_000_000;
const course = { id: 2, fullname: 'Course A' };
const event = (over: Partial<CalendarEvent>): CalendarEvent => ({ id: 1, name: 'Event', eventtype: 'course', timestart: NOW + 3600, timeduration: 0, course, ...over });

describe('toEvents', () => {
  it('lists events in time order, linking activity events to the app', () => {
    const items = toEvents([
      event({ id: 2, name: 'Later one', timestart: NOW + 9 * 86400 }),
      event({ id: 1, name: 'Quiz closes', eventtype: 'close', modulename: 'quiz', url: 'https://m.example/mod/quiz/view.php?id=22' }),
    ], new Set([2]), NOW);
    expect(items.map((i) => i.title)).toEqual(['Quiz closes', 'Later one']);
    expect(items[0]).toMatchObject({ href: '/courses/2/activities/22', kind: 'Closes', course: 'Course A' });
    expect(items[1]).toMatchObject({ href: null, group: 'Later' });
  });

  it('keeps site events, leaves out hidden courses and events that are over', () => {
    const items = toEvents([
      event({ id: 1, name: 'Site event', eventtype: 'site', course: { id: 1, fullname: 'Site' } }),
      event({ id: 2, name: 'Hidden', course: { id: 9, fullname: 'Hidden course' } }),
      event({ id: 3, name: 'Finished', timestart: NOW - 7200, timeduration: 3600 }),
      event({ id: 4, name: 'Happening now', timestart: NOW - 600, timeduration: 3600 }),
    ], new Set([2]), NOW);
    expect(items.map((i) => i.title)).toEqual(['Happening now', 'Site event']);
    expect(items[1]).toMatchObject({ course: null, kind: 'Site event' });
  });
});
