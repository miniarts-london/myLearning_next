import { NextResponse, type NextRequest } from 'next/server';

// An optimistic check only: no session cookie means "go and log in". The real check (decrypting the
// session) happens in lib/dal.ts, next to the data, as the Next.js authentication guide recommends.
const COOKIE = 'mylearning_session';

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(COOKIE);
  const { pathname } = request.nextUrl;

  // API routes check the session themselves and answer 401, rather than redirecting.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (!hasSession && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (hasSession && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next.js internals and static files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
};
