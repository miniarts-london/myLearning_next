import type { NextRequest } from 'next/server';
import { readSession } from '@/lib/session';
import { moodle, MoodleError } from '@/lib/moodle';
import { aiConfigured, aiFetch, ensureIndexed } from '@/lib/ai.server';

// POST { question } → a stream of newline-delimited JSON from the Python service:
//   {"type":"sources",...} then {"type":"text","text":"..."}… then {"type":"done"}
// Everything is checked here first: logged in, enrolled, and which activities the learner can see.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const error = (status: number, message: string) => Response.json({ error: message }, { status });

  if (!aiConfigured()) {
    return error(503, "Ask this course isn't set up on this site.");
  }
  const session = await readSession();
  if (!session) {
    return error(401, 'Log in to ask a question.');
  }
  const courseid = Number((await params).id);
  const { question } = (await request.json().catch(() => ({}))) as { question?: unknown };
  if (!Number.isInteger(courseid) || typeof question !== 'string') {
    return error(400, 'Type a question first.');
  }

  // The learner's own view of the course: Moodle refuses it if they aren't enrolled, and it
  // already leaves out hidden or restricted activities (see moodle.courseContents).
  const [course, sections] = await Promise.all([
    moodle.course(session.token, courseid),
    moodle.courseContents(session.token, courseid).catch((e: unknown) => (e instanceof MoodleError ? null : Promise.reject(e))),
  ]);
  if (!course || !sections) {
    return error(403, 'You need to be enrolled in this course to ask about it.');
  }

  try {
    await ensureIndexed(session.token, course, sections);
    const answer = await aiFetch(`/courses/${courseid}/ask`, {
      method: 'POST',
      body: JSON.stringify({
        question,
        user_id: String(session.userid),
        allowed_cmids: [0, ...sections.flatMap((s) => s.modules.map((m) => m.id))], // 0: course and section summaries
      }),
    });
    if (!answer.ok || !answer.body) {
      const detail = await answer.json().catch(() => null) as { detail?: unknown } | null;
      return error(answer.status, typeof detail?.detail === 'string' ? detail.detail : 'Sorry, something went wrong. Try again in a moment.');
    }
    return new Response(answer.body, {
      headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('Ask this course failed', e);
    return error(502, "Ask this course can't be reached right now. Try again in a moment.");
  }
}
