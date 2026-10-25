import { describe, expect, it } from 'vitest';
import { accessRequestText, tooSoon } from './accessRequest';

describe('accessRequestText', () => {
  const base = { learner: 'Sam Student', course: 'Horse Care', courseid: 3, participantsUrl: 'https://moodle.example/user/index.php?id=3' };

  it('says who, which course, and where to enrol them', () => {
    const text = accessRequestText({ ...base, note: '' });
    expect(text).toContain('Sam Student has asked for access to the course "Horse Care" (id 3)');
    expect(text).toContain('https://moodle.example/user/index.php?id=3');
    expect(text).not.toContain('Their message');
  });

  it("includes the learner's note when there is one", () => {
    expect(accessRequestText({ ...base, note: 'Please add me.' })).toContain('Their message:\nPlease add me.');
  });
});

describe('tooSoon', () => {
  const DAY = 86_400_000;
  it('blocks a second request within the cooldown, and allows it after', () => {
    expect(tooSoon(undefined, 1000, DAY)).toBe(false);
    expect(tooSoon(0, DAY - 1, DAY)).toBe(true);
    expect(tooSoon(0, DAY, DAY)).toBe(false);
  });
  it('never blocks when the cooldown is 0', () => {
    expect(tooSoon(1000, 1000, 0)).toBe(false);
  });
});
