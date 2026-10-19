'use server';

import { redirect } from 'next/navigation';
import { getToken, moodle, MoodleError } from '@/lib/moodle';
import { createSession, deleteSession } from '@/lib/session';

export interface LoginState {
  error?: string;
  username?: string;
}

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!username || !password) {
    return { error: 'Enter your username and password.', username };
  }

  try {
    // Moodle checks the password and returns a token that carries this user's permissions.
    const token = await getToken(username, password);
    const me = await moodle.siteInfo(token);
    await createSession({ token, userid: me.userid, firstname: me.firstname, fullname: me.fullname });
  } catch (e) {
    const message = e instanceof MoodleError ? e.message : 'Moodle could not be reached. Try again in a moment.';
    return { error: message, username };
  }
  redirect('/dashboard'); // Outside the try: redirect() works by throwing.
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect('/login');
}
