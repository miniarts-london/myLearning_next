import { notFound, redirect } from 'next/navigation';
import { verifySession } from '@/lib/dal';
import { moodle, MoodleError } from '@/lib/moodle';
import { activityHref } from '@/lib/links';

// Moodle links to activities (/mod/page/view.php?id=12) don't say which course they're in.
// SafeHtml points them here; this looks the course up and redirects to the activity page.
export default async function ActivityRedirect({ params }: { params: Promise<{ cmid: string }> }) {
  const { cmid } = await params;
  const id = Number(cmid);
  if (!Number.isInteger(id)) {
    notFound();
  }
  const session = await verifySession();
  const cm = await moodle.courseModule(session.token, id).catch((e: unknown) => {
    if (e instanceof MoodleError) {
      return null;
    }
    throw e;
  });
  if (!cm) {
    notFound();
  }
  redirect(activityHref(cm.course, cm.id));
}
