import 'server-only';

// Demo accounts for showing the app off: buttons on the login page that log in as a teacher or a
// student. Only offered when both the username and the password are set (in Vercel's environment
// variables or .env.local). The passwords stay on the server: the buttons only send "teacher" or
// "student". Use accounts with nothing to protect, since anyone with the link can use them.
export type DemoRole = 'teacher' | 'student';

export function demoAccount(role: DemoRole): { username: string; password: string } | null {
  const prefix = role === 'teacher' ? 'DEMO_TEACHER' : 'DEMO_STUDENT';
  const username = process.env[`${prefix}_USERNAME`];
  const password = process.env[`${prefix}_PASSWORD`];
  return username && password ? { username, password } : null;
}

export function demoRoles(): DemoRole[] {
  return (['teacher', 'student'] as const).filter((r) => demoAccount(r) !== null);
}
