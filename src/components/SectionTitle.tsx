import Typography from '@mui/material/Typography';

// A section heading with the MyLearning underline in the theme's primary colour.
export function SectionTitle({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <Typography id={id} variant="h2" component="h2"
      sx={{ pb: 1, mt: 5, mb: 3, borderBottom: 4, borderColor: 'primary.main' }}>
      {children}
    </Typography>
  );
}
