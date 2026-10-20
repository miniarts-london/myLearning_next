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
    <Paper component="section" aria-labelledby="your-submission" elevation={0}
      sx={{ mt: 4, p: { xs: 2, sm: 3 }, boxShadow: '0 0 1.25rem rgba(0, 0, 0, .06)' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Typography id="your-submission" variant="h2" sx={{ fontSize: '1.25rem' }}>Your submission</Typography>
        <Chip label={STATUS_LABEL[view.status]} color={statusColour} variant={submitted ? 'filled' : 'outlined'} size="small" />
      </Stack>

      {/* Announced to screen readers when it changes. */}
      <div role="status">
        {state.message && <Alert severity={state.ok ? 'success' : 'error'} sx={{ mb: 2 }}>{state.message}</Alert>}
      </div>

      {view.grade && (
        <Alert severity="info" icon={false} sx={{ mb: 2 }}>
          <Typography component="p" sx={{ fontWeight: 600 }}>Grade: {view.grade}</Typography>
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
            <Box sx={{ borderLeft: 4, borderColor: 'divider', pl: 2 }}>
              {submittedText}
            </Box>
          ) : (
            <Typography sx={{ color: 'text.secondary' }}>Nothing submitted.</Typography>
          )}
          {submitted && view.canEdit && (
            <Button onClick={() => setEditing(true)} startIcon={<EditIcon />} color="secondary" variant="outlined" sx={{ mt: 2 }}>
              Edit submission
            </Button>
          )}
          {!view.canEdit && !submitted && (
            <Alert severity="warning" sx={{ mt: 2 }}>Submissions are closed for this assignment.</Alert>
          )}
        </>
      )}

      {view.lastModified && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
          Last changed{' '}
          <time dateTime={new Date(view.lastModified * 1000).toISOString()}>
            {new Date(view.lastModified * 1000).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' })}
          </time>
        </Typography>
      )}

      {view.onlineTextEnabled && view.filesEnabled && (
        <Box sx={{ mt: 2 }}>
          {view.files.length > 0 && (
            <List dense disablePadding aria-label="Files you've submitted">
              {view.files.map((f) => (
                <ListItem key={f.url} disableGutters><Link component="a" href={fileUrl(f.url)}>{f.name}</Link></ListItem>
              ))}
            </List>
          )}
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
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
          sx={{ alignItems: 'flex-start', '& .MuiCheckbox-root': { pt: 0.5 } }} />
      )}
      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
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
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
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
      <OpenInNewIcon fontSize="inherit" sx={{ ml: 0.5, verticalAlign: 'middle' }} />
    </Link>
  );
}
