'use server';

import { verifySession } from '@/lib/dal';
import { moodle, moodleUrl, MoodleError } from '@/lib/moodle';
import { ACCESS_NOTE_MAX, accessRequestText, NO_ADMIN_REACHABLE, recipientOrder, tooSoon, type AccessRequestState } from '@/lib/accessRequest';
import { adminUserIds, cooldownMs, supportUserId } from '@/lib/accessRequest.server';

// One request per learner per course a day, so the button can't be used to flood the admin.
// Kept in memory: enough for one server; it resets when the server restarts.
const sent = new Map<string, number>();

export async function requestAccess(_previous: AccessRequestState, formData: FormData): Promise<AccessRequestState> {
  const session = await verifySession();
  const courseid = Number(formData.get('courseid'));
  const note = String(formData.get('note') ?? '').trim().slice(0, ACCESS_NOTE_MAX);
  if (!Number.isInteger(courseid)) {
    return { ok: false, message: "Requests can't be sent from here. Please contact your administrator." };
  }

  const key = `${session.userid}:${courseid}`;
  if (tooSoon(sent.get(key), Date.now(), cooldownMs())) {
    return { ok: true, message: "You've already asked for access to this course today. The administrator will be in touch." };
  }

  try {
    const course = await moodle.course(session.token, courseid);
    if (!course) {
      return { ok: false, message: 'This course could not be found.' };
    }
    const text = accessRequestText({
      learner: session.fullname,
      course: course.fullname,
      courseid,
      note,
      participantsUrl: moodleUrl(`/user/index.php?id=${courseid}`),
    });
    // Try the support user, then each other admin: one may not accept messages from learners
    // (Moodle's message preferences), and the next one might.
    for (const to of recipientOrder(supportUserId(), adminUserIds())) {
      try {
        await moodle.sendMessage(session.token, to, text);
        sent.set(key, Date.now());
        return { ok: true, message: "Your request has been sent to the administrator. You'll get access once they enrol you." };
      } catch (e) {
        if (!(e instanceof MoodleError)) throw e;
        // Moodle's reason is for whoever runs the site, not the learner: it goes to the server log.
        console.warn(`Access request to Moodle user ${to} not sent: ${e.message}`);
      }
    }
    return { ok: false, message: NO_ADMIN_REACHABLE };
  } catch (e) {
    if (e instanceof MoodleError) {
      return { ok: false, message: "Your request couldn't be sent. Please try again later." };
    }
    throw e;
  }
}
