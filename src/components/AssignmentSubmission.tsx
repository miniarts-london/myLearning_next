'use client';

import { useActionState, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SendIcon from '@mui/icons-material/Send';
import { saveSubmission, type SubmissionState } from '@/actions/assignment';
import { STATUS_LABEL, type AssignmentView } from '@/lib/assignment';
import { fileUrl } from '@/lib/files';
import styles from '@/css/AssignmentSubmission.module.css';
import common from '@/css/common.module.css';

// The learner's side of an assignment: status, their online text, and Save / Submit.
// File uploads still happen in Moodle (they need Moodle's separate upload endpoint).
// `submittedText` and `feedback` arrive already rendered (sanitised) on the server, so the
// HTML sanitiser never has to be sent to the browser.
export function AssignmentSubmission({ view, courseid, moodleUrl, submittedText, feedback }: {
  view: AssignmentView;
  courseid: number;
  moodleUrl: string;
  submittedText: React.ReactNode;
  feedback: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<SubmissionState, FormData>(async (previous, formData) => {
    const result = await saveSubmission(previous, formData);
    if (result.ok) {
      setEditing(false); // Back to showing what was saved
    }
    return result;
  }, {});

  const submitted = view.status === 'submitted';
  // The form shows when there's something to write and Moodle allows changes.
  const showForm = view.onlineTextEnabled && view.canEdit && (!submitted || editing);
  const statusColour = submitted ? 'success' : view.status === 'draft' ? 'warning' : 'default';

  return (
    <Paper component="section" aria-labelledby="your-submission" elevation={0} className={`${styles.panel} ${common.softShadow}`}>
      <Stack direction="row" className={styles.header}>
        <Typography id="your-submission" variant="h2" className={styles.heading}>Your submission</Typography>
        <Chip label={STATUS_LABEL[view.status]} color={statusColour} variant={submitted ? 'filled' : 'outlined'} size="small" />
      </Stack>

      {/* Announced to screen readers when it changes. */}
      <div role="status">
        {state.message && <Alert severity={state.ok ? 'success' : 'error'} className={styles.message}>{state.message}</Alert>}
      </div>

      {view.grade && (
        <Alert severity="info" icon={false} className={styles.message}>
          <Typography component="p" className={styles.grade}>Grade: {view.grade}</Typography>
          {feedback}
        </Alert>
      )}

      {!view.onlineTextEnabled ? (
        <Alert severity="info" action={<MoodleButton href={moodleUrl}>Submit in Moodle</MoodleButton>}>
          This assignment takes file uploads, which you add in Moodle.
        </Alert>
      ) : showForm ? (
        <SubmissionForm view={view} courseid={courseid} action={formAction} pending={pending}
          initialText={state.ok ? view.plain : state.text ?? view.plain}
          onCancel={submitted ? () => setEditing(false) : undefined} />
      ) : (
        <>
          {view.html ? (
            <Box className={styles.submitted}>
              {submittedText}
            </Box>
          ) : (
            <Typography className={common.muted}>Nothing submitted.</Typography>
          )}
          {submitted && view.canEdit && (
            <Button onClick={() => setEditing(true)} startIcon={<EditIcon />} color="secondary" variant="outlined" className={styles.gapAbove}>
              Edit submission
            </Button>
          )}
          {!view.canEdit && !submitted && (
            <Alert severity="warning" className={styles.gapAbove}>Submissions are closed for this assignment.</Alert>
          )}
        </>
      )}

      {view.lastModified && (
        <Typography variant="body2" className={`${common.muted} ${styles.gapAbove}`}>
          Last changed{' '}
          <time dateTime={new Date(view.lastModified * 1000).toISOString()}>
            {new Date(view.lastModified * 1000).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' })}
          </time>
        </Typography>
      )}

      {view.onlineTextEnabled && view.filesEnabled && (
        <Box className={styles.gapAbove}>
          {view.files.length > 0 && (
            <List dense disablePadding aria-label="Files you've submitted">
              {view.files.map((f) => (
                <ListItem key={f.url} disableGutters><Link component="a" href={fileUrl(f.url)}>{f.name}</Link></ListItem>
              ))}
            </List>
          )}
          <Typography variant="body2" className={common.muted}>
            This assignment also accepts files. <MoodleLink href={moodleUrl}>Add files in Moodle</MoodleLink>
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

function SubmissionForm({ view, courseid, action, pending, initialText, onCancel }: {
  view: AssignmentView;
  courseid: number;
  action: (formData: FormData) => void;
  pending: boolean;
  initialText: string;
  onCancel?: () => void;
}) {
  return (
    <Stack component="form" action={action} spacing={2}>
      <input type="hidden" name="assignid" value={view.assignid} />
      <input type="hidden" name="courseid" value={courseid} />
      <input type="hidden" name="needsStatement" value={view.statement ? '1' : '0'} />
      <TextField name="text" label="Your answer" multiline minRows={8} defaultValue={initialText}
        variant="outlined" helperText="Leave a blank line between paragraphs." />
      {view.usesDrafts && view.statement && (
        <FormControlLabel control={<Checkbox name="statement" />} label={view.statement}
          className={styles.statement} />
      )}
      <Stack direction="row" spacing={2} className={styles.buttons}>
        {view.usesDrafts ? (
          <>
            <Button type="submit" name="intent" value="submit" variant="contained" endIcon={<SendIcon />} loading={pending}>
              Submit for grading
            </Button>
            <Button type="submit" name="intent" value="draft" variant="outlined" color="secondary" disabled={pending}>
              Save draft
            </Button>
          </>
        ) : (
          <Button type="submit" name="intent" value="save" variant="contained" loading={pending}>Save submission</Button>
        )}
        {onCancel && <Button onClick={onCancel} color="secondary" disabled={pending}>Cancel</Button>}
      </Stack>
      {view.usesDrafts && (
        <Typography variant="body2" className={common.muted}>
          A draft is only for you. Your teacher sees your work once you submit it for grading, and you usually can&apos;t change it after that.
        </Typography>
      )}
    </Stack>
  );
}

function MoodleButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button component="a" href={href} target="_blank" rel="noopener noreferrer" color="inherit" size="small" endIcon={<OpenInNewIcon />}>
      {children}<span className="visually-hidden"> (opens Moodle in a new tab)</span>
    </Button>
  );
}

function MoodleLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link component="a" href={href} target="_blank" rel="noopener noreferrer">
      {children}<span className="visually-hidden"> (opens Moodle in a new tab)</span>
      <OpenInNewIcon fontSize="inherit" className={common.externalIcon} />
    </Link>
  );
}
