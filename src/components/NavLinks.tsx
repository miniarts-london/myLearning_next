'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/catalogue', label: 'Course catalogue' },
];

// A client component only so the current page can be marked with aria-current.
export function NavLinks() {
  const pathname = usePathname();
  return <List current={pathname} />;
}

// Shown while the current path is not known yet, for example in the prerendered shell.
export function NavLinksFallback() {
  return <List current="" />;
}

function List({ current }: { current: string }) {
  return (
    <ul className="nav">
      {links.map(({ href, label }) => (
        <li key={href}>
          <Link href={href} className="nav__link" aria-current={current.startsWith(href) ? 'page' : undefined}>
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
