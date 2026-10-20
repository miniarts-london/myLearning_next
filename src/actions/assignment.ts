'use server';

import { revalidatePath } from 'next/cache';
import { verifySession } from '@/lib/dal';
import { moodle, MoodleError } from '@/lib/moodle';
import { plainToHtml } from '@/lib/assignment';
import type { MoodleWarning } from '@/lib/types';

export interface SubmissionState {
  ok?: boolean;
  message?: string; // Shown to the learner: what happened, or what went wrong
  text?: string;    // What they typed, kept if something went wrong
}

// Saves an online text submission, and hands it in if they pressed "Submit for grading".
// Moodle checks everything that matters (enrolled? still open? allowed to edit?); this only
// turns its answers into messages the learner can act on.
export async function saveSubmission(_previous: SubmissionState, formData: FormData): Promise<SubmissionState> {
  const session = await verifySession();
  const assignid = Number(formData.get('assignid'));
  const courseid = Number(formData.get('courseid'));
  const text = String(formData.get('text') ?? '');
  const intent = formData.get('intent'); // 'draft' | 'submit' | 'save'
  const agreed = formData.get('statement') === 'on';
  const needsStatement = formData.get('needsStatement') === '1';

  if (!text.trim()) {
    return { message: 'Write your answer before saving.', text };
  }
  if (intent === 'submit' && needsStatement && !agreed) {
    return { message: 'Tick the statement to confirm before submitting.', text };
  }

  const firstWarning = (warnings: MoodleWarning[]) => warnings[0]?.message;
  try {
    const saveProblem = firstWarning(await moodle.saveOnlineText(session.token, assignid, plainToHtml(text)));
    if (saveProblem) {
      return { message: saveProblem, text };
    }
    if (intent === 'submit') {
      const submitProblem = firstWarning(await moodle.submitForGrading(session.token, assignid, agreed));
      if (submitProblem) {
        return { message: `Your draft was saved, but it couldn't be submitted: ${submitProblem}`, text };
      }
    }
  } catch (e) {
    if (e instanceof MoodleError) {
      return { message: e.message, text };
    }
    throw e;
  }

  revalidatePath(`/courses/${courseid}`, 'layout');
  revalidatePath('/dashboard'); // Up next drops the deadline once it's submitted
  return {
    ok: true,
    message: intent === 'submit' ? 'Submitted for grading.' : intent === 'draft' ? 'Draft saved. It hasn’t been submitted yet.' : 'Your submission has been saved.',
  };
}
