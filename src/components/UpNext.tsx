import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { GROUP_ORDER, LOOK_AHEAD_DAYS, type UpNextItem } from '@/lib/upNext';

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
    <Paper elevation={0} sx={{ boxShadow: '0 0 1.25rem rgba(0, 0, 0, .06)', px: { xs: 2, sm: 3 }, py: 1 }}>
      {GROUP_ORDER.map((group) => {
        const inGroup = items.filter((i) => i.group === group);
        if (inGroup.length === 0) return null;
        const headingId = `upnext-${group.replace(/\s/g, '-').toLowerCase()}`;
        return (
          <section key={group} aria-labelledby={headingId}>
            <Typography id={headingId} component="h3" variant="overline"
              sx={{ display: 'block', mt: 1.5, color: group === 'Overdue' ? 'error.main' : 'text.secondary', fontWeight: 600 }}>
              {group}
            </Typography>
            <List disablePadding>
              {inGroup.map((item) => (
                <ListItem key={item.id} disableGutters divider
                  sx={{ gap: 2, alignItems: 'flex-start', flexWrap: { xs: 'wrap', sm: 'nowrap' }, '&:last-child': { borderBottom: 0 } }}>
                  <ListItemText
                    sx={{ m: 0, flex: 1, minWidth: '12rem' }}
                    primary={<Link href={item.href} sx={{ fontWeight: 600 }}>{item.title}</Link>}
                    secondary={item.course}
                  />
                  <Typography variant="body2" sx={{ whiteSpace: 'nowrap', color: 'text.secondary', pt: 0.25 }}>
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
