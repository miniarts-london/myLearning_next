import type { NextRequest } from 'next/server';
import { readSession } from '@/lib/session';
import { moodleUrl } from '@/lib/moodle';

// Only these are shown in the page. Anything else (HTML, SVG, PDF, ...) is downloaded,
// because a file served from this app's origin could otherwise run scripts as the learner.
const INLINE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

// Streams a Moodle file (course image, image in a description) to the browser,
// adding the user's token on the server so it never appears in the page.
export async function GET(request: NextRequest) {
  const session = await readSession();
  if (!session) {
    return new Response('Not logged in', { status: 401 });
  }

  const requested = request.nextUrl.searchParams.get('url') ?? '';
  let url: URL;
  try {
    url = new URL(requested);
  } catch {
    return new Response('Bad file address', { status: 400 });
  }

  // Only ever fetch files from our own Moodle: this must not become an open proxy,
  // and the token must only go to Moodle's file scripts, not to any other page.
  const moodle = new URL(moodleUrl());
  const base = moodle.pathname.replace(/\/+$/, '');
  if (url.origin !== moodle.origin) {
    return new Response('Not a Moodle file', { status: 400 });
  }
  if (url.pathname.startsWith(`${base}/pluginfile.php/`)) {
    // pluginfile.php → webservice/pluginfile.php, which accepts the token.
    url.pathname = `${base}/webservice${url.pathname.slice(base.length)}`;
  } else if (!url.pathname.startsWith(`${base}/webservice/pluginfile.php/`)) {
    return new Response('Not a Moodle file', { status: 400 });
  }
  url.searchParams.set('token', session.token);

  // Don't follow redirects: the token must not be carried anywhere else.
  const file = await fetch(url, { cache: 'no-store', redirect: 'manual' });
  if (!file.ok || !file.body) {
    return new Response('File not found', { status: file.status >= 400 ? file.status : 404 });
  }

  const type = (file.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  // The one SVG shown in the page: the patterned placeholder Moodle itself makes for a course with
  // no image (course/generated/). Uploaded SVGs are still downloads. Even if someone opened this
  // address directly, the sandbox policy below stops any script in it from running.
  const generatedCourseImage = type === 'image/svg+xml' && /\/course\/generated\//.test(url.pathname);
  const inline = INLINE_TYPES.has(type) || generatedCourseImage;
  let name = url.pathname.split('/').pop() || 'file';
  try {
    name = decodeURIComponent(name);
  } catch {
    // Keep the encoded name if it isn't valid percent-encoding.
  }
  return new Response(file.body, {
    headers: {
      'Content-Type': inline ? type : 'application/octet-stream',
      'Content-Disposition': inline
        ? 'inline'
        : `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'Cache-Control': 'private, max-age=3600', // This user's browser only.
    },
  });
}
