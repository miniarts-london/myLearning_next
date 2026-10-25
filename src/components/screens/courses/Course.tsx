import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PeopleIcon from '@mui/icons-material/PeopleOutlined';
import { RequestAccess } from '@/components/RequestAccess';
import { SafeHtml } from '@/components/SafeHtml';
import { ProgressBar } from '@/components/ProgressBar';
import { CompletionButton } from '@/components/CompletionButton';
import { SectionTitle } from '@/components/SectionTitle';
import { activityHref } from '@/lib/links';
import type { Course, CourseModule, CourseSection } from '@/lib/types';
import { Grid } from '@mui/material';
import styles from '@/css/Course.module.css';
import common from '@/css/common.module.css';

interface CourseScreenProps {
  course: Course;
  sections: CourseSection[] | null; // null when the user isn't enrolled
  progress: number | null;          // 0–100, or null when nothing is tracked
  moodleCourseUrl: string;          // Where to enrol, in Moodle
  learnersHref?: string;            // Only for the course's teachers and site admins
  canRequestAccess?: boolean;       // Not enrolled: offer "Ask for access" instead of a link to Moodle
}

export function CourseScreen({ course, sections, progress, moodleCourseUrl, learnersHref, canRequestAccess }: CourseScreenProps) {
  return (
    <>
      <Breadcrumbs className={common.breadcrumbs}>
        <Link href="/dashboard">Dashboard</Link>
        <Typography className={common.breadcrumbCurrent}>{course.categoryname}</Typography>
      </Breadcrumbs>
      <Typography variant="h1" className={common.pageTitle}>{course.fullname}</Typography>
      
      <Grid container spacing={2} className={styles.intro}>
        <SafeHtml html={course.summary} className="summary" />
        {progress !== null && <ProgressBar value={progress} label="Course progress" />}
      </Grid>
      {learnersHref && (
        <Button href={learnersHref} variant="outlined" color="secondary" startIcon={<PeopleIcon />} className={styles.learners}>
          Learners
        </Button>
      )}
      {sections === null ? (
        canRequestAccess
          ? <RequestAccess courseid={course.id} coursename={course.fullname} />
          : (
            // Admins (and sites with no one set up to receive requests) get Moodle's own course page.
            <Alert severity="info" className={styles.notEnrolled}>
              You aren&apos;t enrolled in this course.{' '}
              <Link component="a" href={moodleCourseUrl} target="_blank" rel="noopener noreferrer">
                Open it in Moodle<span className="visually-hidden"> (opens in a new tab)</span>
                <OpenInNewIcon fontSize="inherit" className={common.externalIcon} />
              </Link>{' '}to enrol.
            </Alert>
          )
      ) : (
        <>
          {/* {progress !== null && <ProgressBar value={progress} label="Course progress" />} */}
          {sections.map((section) => (
            <section key={section.id} aria-labelledby={`section-${section.id}`}>
              <SectionTitle id={`section-${section.id}`}>{section.name}</SectionTitle>
              <SafeHtml html={section.summary} className="summary" />
              <List disablePadding className={styles.activities}>
                {section.modules.map((m) => (
                  <Activity key={m.id} module={m} courseid={course.id} />
                ))}
              </List>
            </section>
          ))}
        </>
      )}
    </>
  );
}

function Activity({ module: m, courseid }: { module: CourseModule; courseid: number }) {
  const complete = (m.completiondata?.state ?? 0) > 0;
  const isLabel = m.modname === 'label';
  return (
    <Paper component="li" elevation={0} className={`${styles.activity} ${common.softShadow} ${complete ? styles.complete : ''}`}>
      <ListItem component="div" className={styles.activityRow}>
        {!isLabel && (
          <ListItemIcon className={styles.activityIcon}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Moodle's activity icon. */}
            <img src={m.modicon} alt="" width={24} height={24} />
          </ListItemIcon>
        )}
        {isLabel && m.description ? (
          <Box className={styles.grow}><SafeHtml html={m.description} className="activity__label" /></Box>
        ) : (
          <ListItemText
            className={styles.activityText}
            primary={m.url ? (
              // Activities open inside this app; types it can't show yet offer a link to Moodle from there.
              <Link href={activityHref(courseid, m.id)} className={styles.activityLink}>{m.name}</Link>
            ) : m.name}
            secondary={isLabel ? undefined : m.modname}
            slotProps={{ secondary: { variant: 'overline' } }}
          />
        )}
        <CompletionButton module={m} courseid={courseid} size="small" />
      </ListItem>
    </Paper>
  );
}
