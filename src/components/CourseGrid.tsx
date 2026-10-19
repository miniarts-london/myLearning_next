import Box from '@mui/material/Box';

// A responsive list of course cards: as many 15rem-wide columns as fit.
export function CourseGrid({ children }: { children: React.ReactNode }) {
  return (
    <Box component="ul" role="list"
      sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 3, gridTemplateColumns: 'repeat(auto-fill, minmax(15rem, 1fr))' }}>
      {children}
    </Box>
  );
}
