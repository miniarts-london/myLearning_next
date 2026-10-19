import type { NextRequest } from 'next/server';
import { readSession } from '@/lib/session';
import { moodleUrl } from '@/lib/moodle';

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

  // Only ever fetch files from our own Moodle: this must not become an open proxy.
  const moodle = new URL(moodleUrl());
  if (url.origin !== moodle.origin || !url.pathname.includes('/pluginfile.php')) {
    return new Response('Not a Moodle file', { status: 400 });
  }

  // pluginfile.php → webservice/pluginfile.php, which accepts the token.
  if (!url.pathname.includes('/webservice/pluginfile.php')) {
    url.pathname = url.pathname.replace('/pluginfile.php', '/webservice/pluginfile.php');
  }
  url.searchParams.set('token', session.token);

  const file = await fetch(url, { cache: 'no-store' });
  if (!file.ok || !file.body) {
    return new Response('File not found', { status: file.status === 200 ? 404 : file.status });
  }
  return new Response(file.body, {
    headers: {
      'Content-Type': file.headers.get('Content-Type') ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600', // This user's browser only.
    },
  });
}
