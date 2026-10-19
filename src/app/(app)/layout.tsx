import { Suspense } from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import LogoutIcon from '@mui/icons-material/Logout';
import { verifySession } from '@/lib/dal';
import { logout } from '../login/actions';
import { NavLinks, NavLinksFallback } from '@/components/NavLinks';

// The header is static, so it loads instantly. Only the user's name waits for the session,
// behind its own <Suspense> boundary (Next.js 16 with Cache Components).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>
      <AppBar component="header">
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: 72, flexWrap: 'wrap', columnGap: { xs: 3, sm: 4 }, rowGap: 1, py: { xs: 1.5, sm: 0 } }}>
            <Link href="/dashboard" underline="none" color="inherit"
              sx={{ fontSize: '1.375rem', fontWeight: 700, letterSpacing: '.02em', textTransform: 'uppercase', color: 'text.primary' }}>
              My<Box component="span" sx={{ fontWeight: 300 }}>Learning</Box>
            </Link>
            <nav aria-label="Main">
              <Suspense fallback={<NavLinksFallback />}>
                <NavLinks />
              </Suspense>
            </nav>
            <Box sx={{ ml: { sm: 'auto' }, width: { xs: '100%', sm: 'auto' }, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Suspense fallback={<Typography variant="body2" aria-hidden="true">&nbsp;</Typography>}>
                <UserName />
              </Suspense>
              <form action={logout}>
                <Button type="submit" variant="outlined" color="secondary" size="small" startIcon={<LogoutIcon />}>Log out</Button>
              </form>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>
      <Container component="main" id="main" maxWidth="lg" sx={{ pt: 5, pb: 8 }}>{children}</Container>
    </>
  );
}

async function UserName() {
  const session = await verifySession();
  return <Typography variant="body2">{session.fullname}</Typography>;
}
