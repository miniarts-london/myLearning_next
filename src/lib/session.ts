import 'server-only';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { cookies } from 'next/headers';

// The session holds the user's Moodle token, so it is encrypted (not just signed):
// nobody can read the token from the cookie, and the cookie is httpOnly so page scripts can't either.

export interface SessionPayload {
  token: string;
  userid: number;
  firstname: string;
  fullname: string;
}

const COOKIE = 'mylearning_session';
const MAX_AGE = 60 * 60 * 8; // 8 hours

function key(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is not set. Copy .env.example to .env.local and fill it in.');
  }
  // A 256-bit key derived from the secret: A256GCM needs exactly 32 bytes.
  const bytes = new TextEncoder().encode(secret);
  if (bytes.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters.');
  }
  return bytes.slice(0, 32);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const jwt = await new EncryptJWT({ ...payload })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .encrypt(key());

  (await cookies()).set(COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const jwt = (await cookies()).get(COOKIE)?.value;
  if (!jwt) {
    return null;
  }
  try {
    const { payload } = await jwtDecrypt(jwt, key());
    return payload as unknown as SessionPayload;
  } catch {
    return null; // Expired, tampered with, or made with another secret.
  }
}

export async function deleteSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export const SESSION_COOKIE = COOKIE;
