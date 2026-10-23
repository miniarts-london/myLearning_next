import Typography from '@mui/material/Typography';
import styles from '@/css/SectionTitle.module.css';

// A section heading with the MyLearning underline in the theme's primary colour.
export function SectionTitle({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <Typography id={id} variant="h2" component="h2" className={styles.title}>
      {children}
    </Typography>
  );
}
