import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const rounded = Math.round(value);
  return (
    <Box sx={{ display: 'grid', gap: 0.5, my: 2 }}>
      {/* LinearProgress sets role="progressbar" and aria-valuenow itself. */}
      <LinearProgress variant="determinate" value={rounded} color="success" aria-label={label} />
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{rounded}% complete</Typography>
    </Box>
  );
}
