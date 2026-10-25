'use client';

import { useActionState, useEffect } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import SchoolIcon from '@mui/icons-material/SchoolOutlined';
import PersonIcon from '@mui/icons-material/PersonOutlined';
import { demoLogin, type LoginState } from './actions';
import { setWelcoming } from '@/lib/welcome';
import styles from '@/css/Login.module.css';

// "Or try a demo": log in as the demo teacher or student without typing anything. The page only
// shows the buttons for demo accounts that are set up on the server.
export function DemoLogin({ roles }: { roles: ('teacher' | 'student')[] }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(demoLogin, {});

  useEffect(() => {
    if (state.error) setWelcoming(false);
  }, [state]);

  return (
    <section aria-labelledby="demo-title" className={styles.demo}>
      <Divider className={styles.demoDivider}><Typography id="demo-title" component="h2" variant="overline">Or try a demo</Typography></Divider>
      <form action={action} className={styles.demoButtons} onSubmit={() => setWelcoming(true)}>
        {roles.includes('teacher') && (
          <Button type="submit" name="role" value="teacher" variant="outlined" color="secondary" startIcon={<SchoolIcon />}
            disabled={pending} fullWidth>
            Teacher
          </Button>
        )}
        {roles.includes('student') && (
          <Button type="submit" name="role" value="student" variant="outlined" color="secondary" startIcon={<PersonIcon />}
            disabled={pending} fullWidth>
            Student
          </Button>
        )}
      </form>
      {state.error && <Alert severity="error" role="alert" className={styles.demoError}>{state.error}</Alert>}
    </section>
  );
}
