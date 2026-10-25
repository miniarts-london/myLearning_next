import type { Metadata } from 'next';
import { LoginScreen } from '@/components/screens/Login';
import { demoRoles } from '@/lib/demo.server';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage() {
  return <LoginScreen demos={demoRoles()} />;
}
