'use client';

import { useCallback, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Snackbar from '@mui/material/Snackbar';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import { INACTIVE_DAYS, isInactive, lastVisitLabel, type LearnerRow } from '@/lib/learners';
import type { Course } from '@/lib/types';
import common from '@/css/common.module.css';
import styles from '@/css/Learners.module.css';
import { MessageLearner } from './MessageLearner';

type SortKey = 'name' | 'progress' | 'lastVisit';
type Direction = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string; firstDirection: Direction }[] = [
  { key: 'name', label: 'Student', firstDirection: 'asc' },
  { key: 'progress', label: 'Progress', firstDirection: 'asc' },   // Least progress first: who needs help
  { key: 'lastVisit', label: 'Last visit', firstDirection: 'asc' }, // Longest ago first
];

function compare(a: LearnerRow, b: LearnerRow, key: SortKey): number {
  if (key === 'name') return a.name.localeCompare(b.name, 'en-GB');
  if (key === 'progress') return (a.progress ?? -1) - (b.progress ?? -1);
  return a.lastVisit - b.lastVisit; // 0 (never) sorts as longest ago
}

// For the course's teachers and site admins: who's enrolled, how far each learner has got,
// and when they last visited. `now` comes from the server, so both render the same labels.
export function LearnersScreen({ course, learners, now }: { course: Course; learners: LearnerRow[]; now: number }) {
  const [sort, setSort] = useState<{ key: SortKey; direction: Direction }>({ key: 'name', direction: 'asc' });
  const [onlyInactive, setOnlyInactive] = useState(false);
  const [messaging, setMessaging] = useState<{ id: number; name: string } | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const onSent = useCallback((confirmation: string) => { setMessaging(null); setSent(confirmation); }, []);

  const rows = useMemo(() => {
    const shown = onlyInactive ? learners.filter((l) => isInactive(l.lastVisit, now)) : learners;
    const sign = sort.direction === 'asc' ? 1 : -1;
    return [...shown].sort((a, b) => sign * compare(a, b, sort.key) || a.name.localeCompare(b.name, 'en-GB'));
  }, [learners, onlyInactive, sort, now]);

  const withProgress = learners.filter((l) => l.progress !== null);
  const average = withProgress.length > 0
    ? Math.round(withProgress.reduce((sum, l) => sum + (l.progress ?? 0), 0) / withProgress.length)
    : null;
  const inactive = learners.filter((l) => isInactive(l.lastVisit, now)).length;

  const sortBy = (key: SortKey, firstDirection: Direction) =>
    setSort((s) => (s.key === key
      ? { key, direction: s.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: firstDirection }));

  return (
    <>
      <h2 className="visually-hidden">Students</h2>

      {learners.length === 0 ? (
        <Alert severity="info">No students are enrolled in this course yet.</Alert>
      ) : (
        <>
          <dl className={styles.summary}>
            <div><dt>Students</dt><dd>{learners.length}</dd></div>
            {average !== null && <div><dt>Average progress</dt><dd>{average}%</dd></div>}
            <div><dt>Not visited in {INACTIVE_DAYS / 7} weeks</dt><dd>{inactive}</dd></div>
          </dl>

          <FormControlLabel className={styles.filter}
            control={<Checkbox checked={onlyInactive} onChange={(e) => setOnlyInactive(e.target.checked)} />}
            label={`Only show students who haven't visited in ${INACTIVE_DAYS / 7} weeks`} />

          {/* Announced to screen readers when the filter changes. */}
          <p role="status" className={common.muted}>
            Showing {rows.length} of {learners.length} student{learners.length === 1 ? '' : 's'}
          </p>

          <TableContainer component={Paper} elevation={0} className={common.softShadow}>
            <Table>
              <caption className="visually-hidden">Students in {course.fullname}. Select a column heading to sort, or a name to send that student a message.</caption>
              <TableHead>
                <TableRow>
                  {COLUMNS.map(({ key, label, firstDirection }) => {
                    const active = sort.key === key;
                    return (
                      <TableCell key={key} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                        className={key === 'progress' ? styles.progressColumn : undefined}>
                        <TableSortLabel active={active} direction={active ? sort.direction : firstDirection}
                          onClick={() => sortBy(key, firstDirection)}>
                          {label}
                        </TableSortLabel>
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((l) => ( 
                  <TableRow key={l.id}>
                    <TableCell component="th" scope="row" className={styles.name}>
                      <Link component="button" type="button" onClick={() => setMessaging({ id: l.id, name: l.name })}
                        className={styles.nameButton} aria-haspopup="dialog" aria-label={`${l.name}, send a message`}>
                        {l.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {l.progress === null ? (
                        <span className={common.muted}>Not available</span>
                      ) : (
                        <div className={styles.progress}>
                          <LinearProgress variant="determinate" value={l.progress} color="info" className={styles.bar}
                            aria-label={`${l.name}: ${l.done} of ${l.total} activities done`} />
                          <span className={styles.count}>{l.done} of {l.total}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className={isInactive(l.lastVisit, now) ? styles.inactive : undefined}>
                      {lastVisitLabel(l.lastVisit, now)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <MessageLearner courseid={course.id} learner={messaging} onClose={() => setMessaging(null)} onSent={onSent} />
          <Snackbar open={sent !== null} autoHideDuration={5000} onClose={() => setSent(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
            <Alert severity="success" variant="filled" role="status" onClose={() => setSent(null)}>{sent}</Alert>
          </Snackbar>
        </>
      )}
    </>
  );
}
