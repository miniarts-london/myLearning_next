'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getToken, moodle, MoodleError } from '@/lib/moodle';
import { createSession, deleteSession } from '@/lib/session';
import { WELCOME_COOKIE } from '@/lib/welcome';
import { demoAccount } from '@/lib/demo.server';

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
  return signIn(username, password);
}

// The "Teacher" and "Student" demo buttons: the form only says which; the account is read here.
export async function demoLogin(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const role = formData.get('role') === 'teacher' ? 'teacher' : 'student';
  const account = demoAccount(role);
  if (!account) {
    return { error: 'The demo accounts aren\'t set up.' };
  }
  return signIn(account.username, account.password, false);
}

async function signIn(username: string, password: string, keepUsername = true): Promise<LoginState> {
  try {
    // Moodle checks the password and returns a token that carries this user's permissions.
    const token = await getToken(username, password);
    const me = await moodle.siteInfo(token);
    await createSession({ token, userid: me.userid, firstname: me.firstname, fullname: me.fullname });
    // Play the welcome animation once, on the first page after logging in. Not a secret, so the
    // page's script may read and clear it; it expires by itself after a minute anyway.
    (await cookies()).set(WELCOME_COOKIE, encodeURIComponent(me.firstname || 'there'), { path: '/', maxAge: 60, sameSite: 'lax' });
  } catch (e) {
    const message = e instanceof MoodleError ? e.message : 'Moodle could not be reached. Try again in a moment.';
    return { error: message, username: keepUsername ? username : undefined };
  }
  redirect('/dashboard'); // Outside the try: redirect() works by throwing.
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect('/login');
}
