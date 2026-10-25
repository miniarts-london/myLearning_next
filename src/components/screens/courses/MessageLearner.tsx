'use client';

import { useActionState, useEffect } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import SendIcon from '@mui/icons-material/Send';
import { messageLearner } from '@/actions/messageLearner';
import { MESSAGE_MAX, type MessageState } from '@/lib/messages';
import styles from '@/css/Learners.module.css';

// A small dialog for writing to one learner. It arrives in their Moodle messages (and, depending
// on their notification preferences, by email). Closes itself once the message has gone.
export function MessageLearner({ courseid, learner, onClose, onSent }: {
  courseid: number;
  learner: { id: number; name: string } | null;
  onClose: () => void;
  onSent: (confirmation: string) => void;
}) {
  const [state, formAction, pending] = useActionState<MessageState, FormData>(messageLearner, {});

  useEffect(() => {
    if (state.ok && state.message) onSent(state.message);
  }, [state, onSent]);

  return (
    <Dialog open={learner !== null} onClose={pending ? undefined : onClose} fullWidth maxWidth="sm"
      aria-labelledby="message-learner-title">
      {learner && (
        // key: a fresh form (and no old error) for each learner.
        <form action={formAction} key={learner.id}>
          <DialogTitle id="message-learner-title">Message {learner.name}</DialogTitle>
          <DialogContent>
            <input type="hidden" name="courseid" value={courseid} />
            <input type="hidden" name="userid" value={learner.id} />
            <TextField name="text" label="Your message" multiline minRows={4} fullWidth autoFocus required variant="outlined"
              className={styles.messageField} slotProps={{ htmlInput: { maxLength: MESSAGE_MAX } }}
              helperText="They'll see it in their Moodle messages." />
            {state.ok === false && <Alert severity="error" role="alert" className={styles.messageError}>{state.message}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} color="inherit" disabled={pending}>Cancel</Button>
            <Button type="submit" variant="contained" endIcon={<SendIcon />} loading={pending}>Send</Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}
