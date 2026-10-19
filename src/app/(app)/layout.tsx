import Link from 'next/link';
import { Suspense } from 'react';
import { verifySession } from '@/lib/dal';
import { logout } from '../login/actions';
import { NavLinks, NavLinksFallback } from '@/components/NavLinks';

// The header is static, so it loads instantly. Only the user's name waits for the session,
// behind its own <Suspense> boundary (Next.js 16 with Cache Components).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link href="/dashboard" className="brand">My<span>Learning</span></Link>
          <nav aria-label="Main">
            <Suspense fallback={<NavLinksFallback />}>
              <NavLinks />
            </Suspense>
          </nav>
          <div className="user">
            <Suspense fallback={<span className="user__name" aria-hidden="true">&nbsp;</span>}>
              <UserName />
            </Suspense>
            <form action={logout}>
              <button type="submit" className="btn btn--outline btn--small">Log out</button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="container main">{children}</main>
    </>
  );
}

async function UserName() {
  const session = await verifySession();
  return <span className="user__name">{session.fullname}</span>;
}
