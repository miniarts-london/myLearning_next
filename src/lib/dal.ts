import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { readSession } from './session';

// Data access layer: every page, action and route handler that needs the user goes through here.
// cache() means it runs once per request, however many components ask.
export const verifySession = cache(async () => {
  const session = await readSession();
  if (!session) {
    redirect('/login');
  }
  return session;
});
