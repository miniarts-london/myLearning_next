import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { GROUP_ORDER, LOOK_AHEAD_DAYS, type UpNextItem } from '@/lib/upNext';
import styles from '@/css/UpNext.module.css';
import common from '@/css/common.module.css';

// The dashboard's "Up next": deadlines across all courses, grouped Overdue / Today / Tomorrow /
// This week / Later. `items` is null when Moodle's calendar couldn't be reached.
export function UpNext({ items }: { items: UpNextItem[] | null }) {
  if (items === null) {
    return <Alert severity="warning">Upcoming deadlines couldn&apos;t be loaded from Moodle. Try again later.</Alert>;
  }
  if (items.length === 0) {
    return <Alert severity="success">You&apos;re all caught up: nothing is due in the next {LOOK_AHEAD_DAYS / 7} weeks.</Alert>;
  }

  return (
    <Paper elevation={0} className={`${styles.panel} ${common.softShadow}`}>
      {GROUP_ORDER.map((group) => {
        const inGroup = items.filter((i) => i.group === group);
        if (inGroup.length === 0) return null;
        const headingId = `upnext-${group.replace(/\s/g, '-').toLowerCase()}`;
        return (
          <section key={group} aria-labelledby={headingId}>
            <Typography id={headingId} component="h3" variant="overline"
              className={group === 'Overdue' ? `${styles.group} ${styles.overdue}` : styles.group}>
              {group}
            </Typography>
            <List disablePadding>
              {inGroup.map((item) => (
                <ListItem key={item.id} disableGutters divider className={styles.item}>
                  <ListItemText
                    className={styles.text}
                    primary={<Link href={item.href} className={styles.title}>{item.title}</Link>}
                    secondary={item.course}
                  />
                  <Typography variant="body2" className={styles.due}>
                    {item.what} <time dateTime={item.dueISO}>{item.dueText}</time>
                  </Typography>
                  {group === 'Overdue' && <Chip label="Overdue" size="small" color="error" variant="outlined" />}
                </ListItem>
              ))}
            </List>
          </section>
        );
      })}
    </Paper>
  );
}
