'use client';

import Button from '@mui/material/Button';
import { usePathname } from 'next/navigation';
import styles from '@/css/NavLinks.module.css';

const links = [
  { href: '/home', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/catalogue', label: 'Courses' },
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
    <ul className={styles.list}>
      {links.map(({ href, label }) => {
        const active = current.startsWith(href);
        return (
          <li key={href}>
            <Button href={href} color="inherit" aria-current={active ? 'page' : undefined} className={styles.link}>
              {label}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
