'use client';

import { useActionState } from 'react';
import { login, type LoginState } from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="login" noValidate>
      <div className="field">
        <label htmlFor="username">Username</label>
        <input id="username" name="username" autoComplete="username" required defaultValue={state.username}
          aria-describedby={state.error ? 'login-error' : undefined} />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required
          aria-describedby={state.error ? 'login-error' : undefined} />
      </div>
      <p id="login-error" className="login__error" role="alert">{state.error}</p>
      <button type="submit" className="btn btn--primary btn--block" disabled={pending}>
        {pending ? 'Logging in…' : 'Log in'}
      </button>
    </form>
  );
}
