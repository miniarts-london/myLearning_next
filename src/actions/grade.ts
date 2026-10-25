'use server';

import { revalidatePath } from 'next/cache';
import { verifySession } from '@/lib/dal';
import { moodle, MoodleError } from '@/lib/moodle';
import { canSeeLearners } from '@/lib/staff.server';
import { checkGrade, FEEDBACK_MAX, formatGrade, type GradeState } from '@/lib/marking';

// Saves a grade and feedback for one learner, from the teachers' Submissions page.
// Checked here too: only the course's teachers (and admins), only points-graded assignments, and
// only a grade in range. Moodle then checks again that this user may grade.
export async function saveGrade(_previous: GradeState, formData: FormData): Promise<GradeState> {
  const session = await verifySession();
  const courseid = Number(formData.get('courseid'));
  const cmid = Number(formData.get('cmid'));
  const userid = Number(formData.get('userid'));
  const feedback = String(formData.get('feedback') ?? '').trim().slice(0, FEEDBACK_MAX);
  if (![courseid, cmid, userid].every(Number.isInteger) || !(await canSeeLearners(session.token, session.userid, courseid))) {
    return { ok: false, message: "You can't grade this assignment." };
  }

  try {
    const assignment = await moodle.assignment(session.token, courseid, cmid);
    const max = assignment?.grade ?? 0;
    if (!assignment || max <= 0) {
      return { ok: false, message: 'This assignment is graded in Moodle.' };
    }
    const checked = checkGrade(String(formData.get('grade') ?? ''), max);
    if ('error' in checked) {
      return { ok: false, message: checked.error };
    }
    await moodle.saveGrade(session.token, assignment.id, userid, checked.grade, feedback);
    revalidatePath(`/courses/${courseid}/activities/${cmid}/submissions`);
    return { ok: true, message: `Saved: ${formatGrade(checked.grade)} / ${formatGrade(max)}.` };
  } catch (e) {
    if (e instanceof MoodleError) {
      return { ok: false, message: `The grade couldn't be saved. Moodle said: ${e.message}` };
    }
    throw e;
  }
}
