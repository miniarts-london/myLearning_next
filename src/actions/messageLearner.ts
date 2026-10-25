'use server';

import { verifySession } from '@/lib/dal';
import { moodle, MoodleError } from '@/lib/moodle';
import { canSeeLearners } from '@/lib/staff.server';
import { adminUserIds } from '@/lib/accessRequest.server';
import { MESSAGE_MAX, type MessageState } from '@/lib/messages';

// A teacher (or admin) sends one of the course's learners a Moodle message from the learner list.
// Checked here, not just in the page: only staff of the course, and only to a learner in it.
export async function messageLearner(_previous: MessageState, formData: FormData): Promise<MessageState> {
  const session = await verifySession();
  const courseid = Number(formData.get('courseid'));
  const userid = Number(formData.get('userid'));
  const text = String(formData.get('text') ?? '').trim().slice(0, MESSAGE_MAX);
  if (!text) {
    return { ok: false, message: 'Write a message first.' };
  }
  if (!Number.isInteger(courseid) || !Number.isInteger(userid) || !(await canSeeLearners(session.token, session.userid, courseid))) {
    return { ok: false, message: "You can't message learners in this course." };
  }

  try {
    const people = await moodle.enrolledUsers(session.token, courseid);
    const learner = people.find((p) => p.id === userid && p.id !== session.userid && !adminUserIds().has(p.id) && p.roles?.some((r) => r.shortname === 'student'));
    if (!learner) {
      return { ok: false, message: "That learner isn't in this course." };
    }
    await moodle.sendMessage(session.token, userid, text);
    return { ok: true, message: `Message sent to ${learner.fullname}.` };
  } catch (e) {
    if (e instanceof MoodleError) {
      return { ok: false, message: `The message couldn't be sent: ${e.message}` };
    }
    throw e;
  }
}
