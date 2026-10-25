import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { EventItem } from '@/lib/events';
import styles from '@/css/UpNext.module.css';
import common from '@/css/common.module.css';

const GROUPS: EventItem['group'][] = ['Today', 'Tomorrow', 'This week', 'Later'];

// The dashboard's "Up next" for teachers: the upcoming events in their calendar: course, site and personal events and activity
// dates from their Moodle calendar, grouped Today / Tomorrow / This week / Later. Looks like
// "Up next". `items` is null when Moodle's calendar couldn't be reached.
export function UpcomingEvents({ items }: { items: EventItem[] | null }) {
  if (items === null) {
    return <Alert severity="warning">Upcoming events couldn&apos;t be loaded from Moodle. Try again later.</Alert>;
  }
  if (items.length === 0) {
    return <Alert severity="info">No upcoming events in your calendar.</Alert>;
  }

  return (
    <Paper elevation={0} className={`${styles.panel} ${common.softShadow}`}>
      {GROUPS.map((group) => {
        const inGroup = items.filter((i) => i.group === group);
        if (inGroup.length === 0) return null;
        const headingId = `events-${group.replace(/\s/g, '-').toLowerCase()}`;
        return (
          <section key={group} aria-labelledby={headingId}>
            <Typography id={headingId} component="h3" variant="overline" className={styles.group}>{group}</Typography>
            <List disablePadding>
              {inGroup.map((item) => (
                <ListItem key={item.id} disableGutters divider className={styles.item}>
                  <ListItemText
                    className={styles.text}
                    primary={item.href ? <Link href={item.href} className={styles.title}>{item.title}</Link> : <span className={styles.title}>{item.title}</span>}
                    secondary={[item.kind, item.course].filter(Boolean).join(' · ')}
                  />
                  <Typography variant="body2" className={styles.due}>
                    <time dateTime={item.startISO}>{item.whenText}</time>
                  </Typography>
                </ListItem>
              ))}
            </List>
          </section>
        );
      })}
    </Paper>
  );
}
