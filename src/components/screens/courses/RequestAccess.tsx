'use client';

import { useActionState, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import SendIcon from '@mui/icons-material/Send';
import { requestAccess } from '@/actions/accessRequest';
import { ACCESS_NOTE_MAX, type AccessRequestState } from '@/lib/accessRequest';
import styles from '@/css/RequestAccess.module.css';

// For a course the learner isn't enrolled in: "If you're interested, contact the admin." The link
// opens a message box; the message reaches the admin in Moodle's messages (and in their Messages
// panel here), with the course named and a link to enrol the learner.
export function RequestAccess({ courseid, coursename }: { courseid: number; coursename: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<AccessRequestState, FormData>(requestAccess, {});

  if (state.ok) {
    return <Alert severity="success" role="status" className={styles.box}>{state.message}</Alert>;
  }

  return (
    <>
      <Alert severity="info" className={styles.box}>
        You aren&apos;t enrolled in this course. If you&apos;re interested,{' '}
        <Link component="button" type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={styles.link}>
          contact the admin
        </Link>.
      </Alert>

      <Dialog open={open} onClose={pending ? undefined : () => setOpen(false)} fullWidth maxWidth="sm" aria-labelledby="contact-admin-title">
        <form action={formAction}>
          <DialogTitle id="contact-admin-title">Contact the admin</DialogTitle>
          <DialogContent>
            <DialogContentText className={styles.intro}>
              Ask to join <strong>{coursename}</strong>. The admin gets your message in Moodle and can enrol you.
            </DialogContentText>
            <input type="hidden" name="courseid" value={courseid} />
            <TextField name="note" label="Your message (optional)" multiline minRows={3} fullWidth autoFocus variant="outlined"
              placeholder="Why you'd like to join" slotProps={{ htmlInput: { maxLength: ACCESS_NOTE_MAX } }} />
            {state.ok === false && <Alert severity="error" role="alert" className={styles.error}>{state.message}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button color="inherit" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" variant="contained" endIcon={<SendIcon />} loading={pending}>Send</Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
