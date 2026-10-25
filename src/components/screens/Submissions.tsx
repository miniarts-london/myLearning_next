'use client';

import { useActionState, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { saveGrade } from '@/actions/grade';
import { FEEDBACK_MAX, formatGrade, MARKING_STATUS_LABEL, needsGrading, type GradeState, type SubmissionRow } from '@/lib/marking';
import type { Course } from '@/lib/types';
import common from '@/css/common.module.css';
import styles from '@/css/Submissions.module.css';

type Filter = 'all' | 'needs' | 'submitted' | 'missing';

const when = (s: number) => new Date(s * 1000).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' });

interface Props {
  course: Course;
  cmid: number;
  assignmentName: string;
  maxGrade: number | null; // null: not graded in points here (scale, rubric…): grade in Moodle
  rows: SubmissionRow[];
  loadFailed: boolean;
  gradingUrl: string;
}

export function SubmissionsScreen({ course, cmid, assignmentName, maxGrade, rows, loadFailed, gradingUrl }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<SubmissionRow | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const counts = {
    submitted: rows.filter((r) => r.status === 'submitted').length,
    needs: rows.filter(needsGrading).length,
    missing: rows.filter((r) => r.status !== 'submitted').length,
  };
  const shown = useMemo(() => rows.filter((r) =>
    filter === 'all' ? true : filter === 'needs' ? needsGrading(r) : filter === 'submitted' ? r.status === 'submitted' : r.status !== 'submitted'),
  [rows, filter]);

  return (
    <>
      <Breadcrumbs className={common.breadcrumbs}>
        <Link href="/dashboard">Dashboard</Link>
        <Link href={`/courses/${course.id}`}>{course.fullname}</Link>
        <Link href={`/courses/${course.id}/activities/${cmid}`}>{assignmentName}</Link>
      </Breadcrumbs>
      <Typography variant="h1" className={common.pageTitle}>Submissions</Typography>

      {loadFailed ? (
        <Alert severity="warning">The submissions couldn&apos;t be loaded from Moodle. Try again later, or open them in Moodle.</Alert>
      ) : (
        <>
          <dl className={styles.summary}>
            <div><dt>Learners</dt><dd>{rows.length}</dd></div>
            <div><dt>Submitted</dt><dd>{counts.submitted}</dd></div>
            <div><dt>To grade</dt><dd>{counts.needs}</dd></div>
          </dl>

          {maxGrade === null && (
            <Alert severity="info" className={styles.notice}>
              This assignment isn&apos;t graded in points (it may use a scale or a rubric), so grade it in Moodle.
            </Alert>
          )}

          <div className={styles.toolbar}>
            <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v: Filter | null) => v && setFilter(v)} aria-label="Show">
              <ToggleButton value="all">All ({rows.length})</ToggleButton>
              <ToggleButton value="needs">To grade ({counts.needs})</ToggleButton>
              <ToggleButton value="submitted">Submitted ({counts.submitted})</ToggleButton>
              <ToggleButton value="missing">Not submitted ({counts.missing})</ToggleButton>
            </ToggleButtonGroup>
            <Button component="a" href={gradingUrl} target="_blank" rel="noopener noreferrer" color="secondary" size="small" endIcon={<OpenInNewIcon />}>
              Grade in Moodle<span className="visually-hidden"> (opens in a new tab)</span>
            </Button>
          </div>

          <p role="status" className={common.muted}>Showing {shown.length} of {rows.length}</p>

          <TableContainer component={Paper} elevation={0} className={common.softShadow}>
            <Table>
              <caption className="visually-hidden">Submissions for {assignmentName}</caption>
              <TableHead>
                <TableRow>
                  <TableCell>Learner</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last changed</TableCell>
                  <TableCell>Grade</TableCell>
                  <TableCell><span className="visually-hidden">Actions</span></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shown.map((r) => (
                  <TableRow key={r.userid}>
                    <TableCell component="th" scope="row" className={styles.name}>{r.name}</TableCell>
                    <TableCell>
                      <Chip size="small" label={MARKING_STATUS_LABEL[r.status]}
                        color={r.status === 'submitted' ? 'success' : r.status === 'draft' ? 'warning' : 'default'}
                        variant={r.status === 'submitted' ? 'filled' : 'outlined'} />
                    </TableCell>
                    <TableCell>{r.submittedAt ? when(r.submittedAt) : <span className={common.muted}>—</span>}</TableCell>
                    <TableCell>
                      {r.grade !== null
                        ? `${formatGrade(r.grade)}${maxGrade ? ` / ${formatGrade(maxGrade)}` : ''}`
                        : <span className={common.muted}>Not graded</span>}
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant={needsGrading(r) ? 'contained' : 'outlined'} color={needsGrading(r) ? 'primary' : 'secondary'}
                        onClick={() => setOpen(r)} aria-label={`${maxGrade ? 'View and grade' : 'View'} ${r.name}'s submission`}>
                        {maxGrade ? (r.grade === null ? 'Grade' : 'Regrade') : 'View'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {open && (
        <GradeDialog key={open.userid} row={open} courseid={course.id} cmid={cmid} maxGrade={maxGrade}
          onClose={() => setOpen(null)} onSaved={(m) => { setOpen(null); setSaved(m); }} />
      )}
      <Snackbar open={saved !== null} autoHideDuration={5000} onClose={() => setSaved(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <Alert severity="success" variant="filled" role="status" onClose={() => setSaved(null)}>{saved}</Alert>
      </Snackbar>
    </>
  );
}

// One learner's work, and (for points-graded assignments) a grade and a feedback comment.
function GradeDialog({ row, courseid, cmid, maxGrade, onClose, onSaved }: {
  row: SubmissionRow;
  courseid: number;
  cmid: number;
  maxGrade: number | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [state, action, pending] = useActionState<GradeState, FormData>(async (prev, formData) => {
    const result = await saveGrade(prev, formData);
    if (result.ok) onSaved(`${row.name}: ${result.message}`);
    return result;
  }, {});

  return (
    <Dialog open onClose={pending ? undefined : onClose} fullWidth maxWidth="md" aria-labelledby="grade-title">
      <form action={action}>
        <DialogTitle id="grade-title">{row.name}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="overline" component="h3" className={styles.label}>
            {MARKING_STATUS_LABEL[row.status]}{row.submittedAt ? ` · ${when(row.submittedAt)}` : ''}
          </Typography>
          {row.textHtml ? (
            // Cleaned on the server before it reached this page.
            <div className={`prose ${styles.work}`} dangerouslySetInnerHTML={{ __html: row.textHtml }} />
          ) : (
            <Typography className={common.muted}>No online text.</Typography>
          )}
          {row.files.length > 0 && (
            <ul className={styles.files} aria-label="Submitted files">
              {row.files.map((f) => <li key={f.href}><Link component="a" href={f.href}>{f.name}</Link></li>)}
            </ul>
          )}

          {maxGrade !== null && (
            <div className={styles.gradeForm}>
              <input type="hidden" name="courseid" value={courseid} />
              <input type="hidden" name="cmid" value={cmid} />
              <input type="hidden" name="userid" value={row.userid} />
              <TextField name="grade" label={`Grade (out of ${formatGrade(maxGrade)})`} type="number" required
                defaultValue={row.grade ?? ''} variant="outlined" className={styles.gradeField}
                slotProps={{ htmlInput: { min: 0, max: maxGrade, step: 0.01 } }} />
              <TextField name="feedback" label="Feedback (optional)" multiline minRows={3} fullWidth variant="outlined"
                helperText="The learner sees this with their grade, in Moodle and in this app."
                slotProps={{ htmlInput: { maxLength: FEEDBACK_MAX } }} />
              {state.ok === false && <Alert severity="error" role="alert">{state.message}</Alert>}
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="inherit" disabled={pending}>{maxGrade !== null ? 'Cancel' : 'Close'}</Button>
          {maxGrade !== null && <Button type="submit" variant="contained" loading={pending}>Save grade</Button>}
        </DialogActions>
      </form>
    </Dialog>
  );
}
