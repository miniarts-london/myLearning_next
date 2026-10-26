'use client';

import { useSearchParams } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { AssignmentSubmissions } from '@/components/screens/submissions/AssignmentSubmissions';
import { activityHref } from '@/lib/links';
import type { AssignmentItem } from '@/lib/marking';
import type { Course } from '@/lib/types';
import common from '@/css/common.module.css';
import styles from '@/css/Submissions.module.css';

const day = (s: number) => new Date(s * 1000).toLocaleDateString('en-GB', { dateStyle: 'medium', timeZone: 'Europe/London' });

interface Props {
  course: Course;
  items: AssignmentItem[]; // Already sorted: most to grade first
  students: number;
  loadFailed: boolean;
  moodleUrl: string;       // Moodle's list of the course's assignments
}

// The open assignment is in the address (?assignment=<cmid>), so the drawer can be linked to
// (from an assignment's page) and the back button closes it. Changing it with history.pushState
// doesn't reload the page: the submissions are already here.
function useOpenAssignment(): [number | null, (cmid: number | null) => void] {
  const params = useSearchParams();
  const value = Number(params.get('assignment'));
  const open = (cmid: number | null) => {
    const url = new URL(window.location.href);
    if (cmid === null) url.searchParams.delete('assignment');
    else url.searchParams.set('assignment', String(cmid));
    window.history.pushState(null, '', url);
  };
  return [Number.isInteger(value) && value > 0 ? value : null, open];
}

// Every assignment in a course at a glance, for its teachers. Selecting one opens its
// submissions in a drawer.
export function CourseSubmissionsScreen({ course, items, students, loadFailed, moodleUrl }: Props) {
  const [openCmid, setOpenCmid] = useOpenAssignment();
  const open = items.find((i) => i.summary.cmid === openCmid) ?? null;
  const toGrade = items.reduce((n, i) => n + i.summary.toGrade, 0);

  return (
    <>
      <h2 className="visually-hidden">Assignments</h2>

      {loadFailed ? (
        <Alert severity="warning">The submissions couldn&apos;t be loaded from Moodle. Try again later, or open them in Moodle.</Alert>
      ) : items.length === 0 ? (
        <Alert severity="info">This course has no assignments yet.</Alert>
      ) : (
        <>
          <dl className={styles.summary}>
            <div><dt>Assignments</dt><dd>{items.length}</dd></div>
            <div><dt>Students</dt><dd>{students}</dd></div>
            <div><dt>To grade</dt><dd>{toGrade}</dd></div>
          </dl>

          <div className={styles.toolbar}>
            <p className={common.muted}>Assignments with the most work to grade come first. Select one to see its submissions.</p>
            <Button component="a" href={moodleUrl} target="_blank" rel="noopener noreferrer" color="secondary" size="small" endIcon={<OpenInNewIcon />}>
              Open in Moodle<span className="visually-hidden"> (opens in a new tab)</span>
            </Button>
          </div>

          <TableContainer component={Paper} elevation={0} className={common.softShadow}>
            <Table>
              <caption className="visually-hidden">Submissions for each assignment in {course.fullname}</caption>
              <TableHead>
                <TableRow>
                  <TableCell>Assignment</TableCell>
                  <TableCell>Due</TableCell>
                  <TableCell>Submitted</TableCell>
                  <TableCell>To grade</TableCell>
                  <TableCell>Graded</TableCell>
                  <TableCell>Not submitted</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map(({ summary: r }) => (
                  <TableRow key={r.cmid} hover className={styles.clickable} onClick={() => setOpenCmid(r.cmid)}>
                    <TableCell component="th" scope="row" className={styles.name}>
                      {/* The button is what keyboard and screen reader users reach; the row click is a shortcut. */}
                      <Link component="button" type="button" className={styles.rowButton}
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); setOpenCmid(r.cmid); }}>
                        {r.name}
                      </Link>
                    </TableCell>
                    <TableCell>{r.duedate ? day(r.duedate) : <span className={common.muted}>No due date</span>}</TableCell>
                    <TableCell>{r.submitted} of {r.students}</TableCell>
                    <TableCell>
                      {r.toGrade > 0
                        ? <Chip size="small" color="primary" label={r.toGrade} />
                        : <span className={common.muted}>0</span>}
                    </TableCell>
                    <TableCell>{r.graded}</TableCell>
                    <TableCell>
                      {r.missing}
                      {r.overdue && <Chip size="small" color="warning" variant="outlined" label="Overdue" className={styles.overdue} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <Drawer anchor="right" open={open !== null} onClose={() => setOpenCmid(null)}
        slotProps={{ paper: { className: styles.drawer, 'aria-labelledby': 'submissions-title' } as object }}>
        {open && (
          <>
            <div className={styles.drawerHeader}>
              <div>
                <Typography variant="overline" component="p" className={styles.drawerKicker}>Submissions</Typography>
                <Typography variant="h5" component="h2" id="submissions-title">{open.summary.name}</Typography>
              </div>
              <IconButton onClick={() => setOpenCmid(null)} aria-label="Close submissions"><CloseIcon /></IconButton>
            </div>
            <p className={styles.drawerLinks}>
              <Link href={activityHref(course.id, open.summary.cmid)}>Open the assignment</Link>
            </p>
            <AssignmentSubmissions key={open.summary.cmid} courseid={course.id} cmid={open.summary.cmid}
              assignmentName={open.summary.name} maxGrade={open.maxGrade} rows={open.rows} gradingUrl={open.gradingUrl} />
          </>
        )}
      </Drawer>
    </>
  );
}
