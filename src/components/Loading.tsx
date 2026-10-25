import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import styles from '@/css/Loading.module.css';

export function Loading({ label }: { label: string }) {
  return (
    // data-loading: lets the welcome animation wait until the page has finished loading.
    <Box role="status" className={styles.status} data-loading>
      <CircularProgress size={20} color="inherit" aria-hidden />
      <Typography>{label}</Typography>
    </Box>
  );
}
