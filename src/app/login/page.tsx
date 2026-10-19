import type { Metadata } from 'next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <h1 id="login-title">
          <span className="eyebrow">Welcome to</span>
          MyLearning
        </h1>
        <LoginForm />
        <p className="hint">Use your Moodle username and password.</p>
      </section>
    </main>
  );
}
