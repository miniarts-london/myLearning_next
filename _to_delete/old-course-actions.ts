'use server';

import { revalidatePath } from 'next/cache';
import { verifySession } from '@/lib/dal';
import { moodle } from '@/lib/moodle';

// "Mark as done" for activities with manual completion. Moodle checks the user is allowed to.
export async function toggleCompletion(formData: FormData): Promise<void> {
  const session = await verifySession();
  const courseid = Number(formData.get('courseid'));
  const cmid = Number(formData.get('cmid'));
  const completed = formData.get('completed') === '1';

  await moodle.setManualCompletion(session.token, cmid, completed);
  revalidatePath(`/courses/${courseid}`, 'layout'); // The course page and its activity pages.
  revalidatePath('/dashboard'); // The course's progress bar changes too.
}
