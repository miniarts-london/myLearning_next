import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CheckIcon from '@mui/icons-material/Check';
import { toggleCompletion } from '@/actions/completion';
import type { CourseModule } from '@/lib/types';

// Shows an activity's completion: a chip when Moodle tracks it automatically,
// or a "Mark as done" button when the learner ticks it off themselves.
export function CompletionButton({ module: m, courseid, size = 'medium' }: {
  module: CourseModule;
  courseid: number;
  size?: 'small' | 'medium';
}) {
  const completion = m.completiondata;
  if (!completion?.hascompletion) {
    return null;
  }
  const complete = completion.state > 0;
  if (completion.isautomatic) {
    return (
      <Chip size="small" variant="outlined" color={complete ? 'success' : 'default'}
        icon={complete ? <CheckIcon /> : undefined} label={complete ? 'Done' : 'To do'} />
    );
  }
  return (
    <form action={toggleCompletion}>
      <input type="hidden" name="courseid" value={courseid} />
      <input type="hidden" name="cmid" value={m.id} />
      <input type="hidden" name="completed" value={complete ? '0' : '1'} />
      <Button type="submit" size={size} variant={complete ? 'contained' : 'outlined'} color={complete ? 'success' : 'secondary'}
        startIcon={complete ? <CheckIcon /> : undefined}
        aria-label={complete ? `${m.name}: done. Mark as not done` : `Mark ${m.name} as done`}>
        {complete ? 'Done' : 'Mark as done'}
      </Button>
    </form>
  );
}
