// "Contact the admin" about a course you aren't enrolled in: shared rules, kept free of server code.

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

// Who to ask, in order: the support user first, then the other admins, each once.
export function recipientOrder(supportId: number, adminIds: Iterable<number>): number[] {
  return [...new Set([supportId, ...adminIds])];
}

// Shown when no admin could receive the request (usually their Moodle message preferences).
export const NO_ADMIN_REACHABLE = "Your request couldn't be sent: the administrator can't receive messages at the moment. Please try again later.";
