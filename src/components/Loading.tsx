import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

export function Loading({ label }: { label: string }) {
  return (
    <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
      <CircularProgress size={20} color="inherit" aria-hidden />
      <Typography>{label}</Typography>
    </Box>
  );
}
