'use client';

import { useActionState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { login, type LoginState } from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const describedBy = state.error ? 'login-error' : undefined;

  return (
    <Stack component="form" action={action} noValidate spacing={3}>
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
