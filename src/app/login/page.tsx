import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { LoginScreen } from '@/components/screens/Login';
import { DemoLogin } from './DemoLogin';
import { demoRoles } from '@/lib/demo.server';

export const metadata: Metadata = { title: 'Log in' };

// The login form shows straight away. The demo buttons follow once the server has checked which
// demo accounts are set up; that check happens per request (connection()), not when the site is
// built, so adding them in Vercel takes effect without rebuilding. Only the buttons wait: the form
// itself is never replaced, so nothing typed into it is lost.
export default function LoginPage() {
  return <LoginScreen demo={<Suspense fallback={null}><Demo /></Suspense>} />;
}

async function Demo() {
  await connection();
  const roles = demoRoles();
  return roles.length > 0 ? <DemoLogin roles={roles} /> : null;
}
