import { Suspense } from 'react';
import AppBar from '@mui/material/AppBar';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import LogoutIcon from '@mui/icons-material/Logout';
import { verifySession } from '@/lib/dal';
import { logout } from '../login/actions';
import { NavLinks, NavLinksFallback } from '@/components/NavLinks';
import { Assistant } from '@/components/assistant/Assistant';
import { Messages } from '@/components/messages/Messages';
import { WelcomeIntro } from '@/components/WelcomeIntro';
import { WELCOME_COOKIE, WELCOME_EARLY_SCRIPT } from '@/lib/welcome';
import { cookies } from 'next/headers';
import { assistantConfigured } from '@/lib/agent/config';
import styles from '@/css/AppLayout.module.css';

// The header is static, so it loads instantly. Only the user's name waits for the session,
// behind its own <Suspense> boundary (Next.js 16 with Cache Components).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* On a full page load right after logging in, hide the page before it's first drawn, so it
          only appears once the welcome animation's horse has landed. (After the login form, the
          form itself does this; this covers reloads and slow connections.) */}
      <script dangerouslySetInnerHTML={{ __html: WELCOME_EARLY_SCRIPT }} />
      <a className="skip-link" href="#main">Skip to main content</a>
      <AppBar component="header" data-app-shell>
        <Container maxWidth="lg">
          <Toolbar disableGutters className={styles.toolbar}>
            <Link href="/dashboard" underline="none" color="inherit" className={styles.brand}>
              My<span className={styles.brandLight}>Learning</span>
            </Link>
            <nav aria-label="Main">
              <Suspense fallback={<NavLinksFallback />}>
                <NavLinks />
              </Suspense>
            </nav>
            <div className={styles.user}>
              <Suspense fallback={<Typography variant="body2" aria-hidden="true">&nbsp;</Typography>}>
                <UserName />
              </Suspense>
              {/* Messages: a client component; <Suspense> so the prerendered shell doesn't wait for it. */}
              <Suspense fallback={null}><Messages /></Suspense>
              <form action={logout}>
                <Button type="submit" variant="outlined" color="secondary" size="small" startIcon={<LogoutIcon />}>Log out</Button>
              </form>
            </div>
          </Toolbar>
        </Container>
      </AppBar>
      <Container component="main" id="main" maxWidth="lg" className={styles.main} data-app-shell>{children}</Container>
      {/* The assistant, on every logged-in page. <Suspense>: it reads the page address, which isn't
          known when the shell is prerendered. Only shown when a Claude API key is set. */}
      {assistantConfigured() && <Suspense fallback={null}><Assistant /></Suspense>}
      {/* Right after logging in: a short welcome with the horse (see WelcomeIntro). */}
      <Suspense fallback={null}><Welcome /></Suspense>
    </>
  );
}

async function Welcome() {
  if (!(await cookies()).get(WELCOME_COOKIE)) {
    return null;
  }
  const session = await verifySession();
  return <WelcomeIntro firstname={session.firstname} withAssistant={assistantConfigured()} />;
}

async function UserName() {
  const session = await verifySession();
  return <Typography variant="body2">{session.fullname}</Typography>;
}
