'use client';

import { useActionState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SchoolIcon from '@mui/icons-material/SchoolOutlined';
import PersonIcon from '@mui/icons-material/PersonOutlined';
import { demoLogin, login, type LoginState } from './actions';
import styles from '@/css/Login.module.css';

export function LoginForm({ demos = [] }: { demos?: ('teacher' | 'student')[] }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [demoState, demoAction, demoPending] = useActionState<LoginState, FormData>(demoLogin, {});
  const describedBy = state.error ? 'login-error' : undefined;

  return (
    <>
      <Stack component="form" action={action} noValidate spacing={3}>
        <TextField id="username" name="username" label="Username" autoComplete="username" required
          defaultValue={state.username} error={!!state.error}
          slotProps={{ htmlInput: { 'aria-describedby': describedBy } }} />
        <TextField id="password" name="password" type="password" label="Password" autoComplete="current-password" required
          error={!!state.error}
          slotProps={{ htmlInput: { 'aria-describedby': describedBy } }} />
        {/* Moodle's own message, e.g. "Invalid login, please try again". */}
        {state.error && <Alert id="login-error" severity="error" role="alert">{state.error}</Alert>}
        <Button type="submit" variant="contained" color="primary" size="large" fullWidth loading={pending} loadingPosition="end"
          disabled={demoPending}>
          {pending ? 'Logging in…' : 'Log in'}
        </Button>
      </Stack>

      {demos.length > 0 && (
        // Demo accounts, for trying the app without a Moodle account.
        <section aria-labelledby="demo-title" className={styles.demo}>
          <Divider className={styles.demoDivider}><Typography id="demo-title" component="h2" variant="overline">Or try a demo</Typography></Divider>
          <form action={demoAction} className={styles.demoButtons}>
            {demos.includes('teacher') && (
              <Button type="submit" name="role" value="teacher" variant="outlined" color="secondary" startIcon={<SchoolIcon />}
                disabled={pending || demoPending} fullWidth>
                Teacher
              </Button>
            )}
            {demos.includes('student') && (
              <Button type="submit" name="role" value="student" variant="outlined" color="secondary" startIcon={<PersonIcon />}
                disabled={pending || demoPending} fullWidth>
                Student
              </Button>
            )}
          </form>
          {demoState.error && <Alert severity="error" role="alert" className={styles.demoError}>{demoState.error}</Alert>}
        </section>
      )}
    </>
  );
}
