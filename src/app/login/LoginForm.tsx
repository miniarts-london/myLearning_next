'use client';

import { useActionState, useEffect } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { login, type LoginState } from './actions';
import { setWelcoming } from '@/lib/welcome';

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const describedBy = state.error ? 'login-error' : undefined;

  // Logging in hides the next page straight away, so it doesn't flash up before the welcome
  // animation starts. If the login fails, there's no next page: show this one again.
  useEffect(() => {
    if (state.error) setWelcoming(false);
  }, [state]);

  return (
    <Stack component="form" action={action} noValidate spacing={3} onSubmit={() => setWelcoming(true)}>
      <TextField id="username" name="username" label="Username" autoComplete="username" required
        defaultValue={state.username} error={!!state.error}
        slotProps={{ htmlInput: { 'aria-describedby': describedBy } }} />
      <TextField id="password" name="password" type="password" label="Password" autoComplete="current-password" required
        error={!!state.error}
        slotProps={{ htmlInput: { 'aria-describedby': describedBy } }} />
      {/* Moodle's own message, e.g. "Invalid login, please try again". */}
      {state.error && <Alert id="login-error" severity="error" role="alert">{state.error}</Alert>}
      <Button type="submit" variant="contained" color="primary" size="large" fullWidth loading={pending} loadingPosition="end">
        {pending ? 'Logging in…' : 'Log in'}
      </Button>
    </Stack>
  );
}
