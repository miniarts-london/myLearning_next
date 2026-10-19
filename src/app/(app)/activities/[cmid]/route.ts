import type { NextRequest } from 'next/server';
import { readSession } from '@/lib/session';
import { moodle, MoodleError } from '@/lib/moodle';
import { activityHref } from '@/lib/links';

// Moodle links to activities (/mod/page/view.php?id=12) don't say which course they're in.
// SafeHtml points them here; this looks the course up and redirects to the activity page.
export async function GET(request: NextRequest, { params }: { params: Promise<{ cmid: string }> }) {
  const session = await readSession();
  if (!session) {
    return Response.redirect(new URL('/login', request.url));
  }
  const id = Number((await params).cmid);
  if (!Number.isInteger(id)) {
    return new Response('Not found', { status: 404 });
  }
  try {
    const cm = await moodle.courseModule(session.token, id);
    return Response.redirect(new URL(activityHref(cm.course, cm.id), request.url));
  } catch (e) {
    if (e instanceof MoodleError) {
      return new Response('Not found', { status: 404 });
    }
    throw e;
  }
}
