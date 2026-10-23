import Box from '@mui/material/Box';
import { CircularProgressWithLabel, type RingColor } from './CircularProgressWithLabel';
import styles from '@/css/ProgressBar.module.css';

export function ProgressBar({ value, label, size, color }: { value: number; label: string; size?: number; color?: RingColor }) {
  return (
    <Box className={styles.wrap}>
      <CircularProgressWithLabel value={value} label={label} size={size} color={color} />
    </Box>
  );
}
