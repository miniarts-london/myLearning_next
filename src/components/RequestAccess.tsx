'use client';

import { useActionState, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SendIcon from '@mui/icons-material/Send';
import { requestAccess } from '@/actions/accessRequest';
import { ACCESS_NOTE_MAX, type AccessRequestState } from '@/lib/accessRequest';
import styles from '@/css/RequestAccess.module.css';

// For a course the learner isn't enrolled in: ask the administrator for access, with an optional
// note. The request arrives as a Moodle message.
export function RequestAccess({ courseid, coursename }: { courseid: number; coursename: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<AccessRequestState, FormData>(requestAccess, {});

  if (state.ok) {
    return <Alert severity="success" role="status" className={styles.box}>{state.message}</Alert>;
  }

  return (
    <Alert severity="info" className={styles.box}
      action={!open && <Button color="inherit" size="small" onClick={() => setOpen(true)}>Ask for access</Button>}>
      <Typography component="p">You aren&apos;t enrolled in this course.</Typography>
      {open && (
        <form action={formAction} className={styles.form}>
          <input type="hidden" name="courseid" value={courseid} />
          <TextField name="note" label="Message to the administrator (optional)" multiline minRows={2} fullWidth variant="outlined"
            placeholder={`Why you'd like to join ${coursename}`} slotProps={{ htmlInput: { maxLength: ACCESS_NOTE_MAX } }} />
          {state.message && <Alert severity="error" role="alert" className={styles.error}>{state.message}</Alert>}
          <Stack direction="row" spacing={1} className={styles.buttons}>
            <Button type="submit" variant="contained" endIcon={<SendIcon />} loading={pending}>Send request</Button>
            <Button color="inherit" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          </Stack>
        </form>
      )}
    </Alert>
  );
}
