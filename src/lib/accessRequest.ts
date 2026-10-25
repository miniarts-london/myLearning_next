// "Ask for access" to a course you aren't enrolled in: shared rules, kept free of server code.

export const ACCESS_NOTE_MAX = 500;

export interface AccessRequestState {
  ok?: boolean;
  message?: string;
}

// Whether a previous request (at `last`, ms) is too recent to send another.
export function tooSoon(last: number | undefined, now: number, cooldown: number): boolean {
  return last !== undefined && now - last < cooldown;
}

// The message the administrator receives in Moodle.
export function accessRequestText(opts: { learner: string; course: string; courseid: number; note: string; participantsUrl: string }): string {
  return [
    `${opts.learner} has asked for access to the course "${opts.course}" (id ${opts.courseid}) in MyLearning.`,
    opts.note ? `\nTheir message:\n${opts.note}` : '',
    `\nTo enrol them, open the course's participants page: ${opts.participantsUrl}`,
  ].filter(Boolean).join('\n');
}
