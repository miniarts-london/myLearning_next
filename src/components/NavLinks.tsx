'use client';

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { usePathname } from 'next/navigation';

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
    <Stack component="ul" direction="row" spacing={{ xs: 2.5, sm: 3 }} sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {links.map(({ href, label }) => {
        const active = current.startsWith(href);
        return (
          <li key={href}>
            <Button href={href} color="inherit" aria-current={active ? 'page' : undefined}
              sx={{
                px: 0, minWidth: 0, fontSize: '.8125rem', fontWeight: 600, borderRadius: 0,
                // The underline grows in on hover and stays on the current page.
                '&::after': {
                  content: '""', position: 'absolute', left: 0, right: 0, bottom: 0, height: 4,
                  bgcolor: 'primary.main', transform: active ? 'scaleX(1)' : 'scaleX(0)',
                  transformOrigin: 'left', transition: 'transform .25s',
                },
                '&:hover': { bgcolor: 'transparent' },
                '&:hover::after': { transform: 'scaleX(1)' },
              }}>
              {label}
            </Button>
          </li>
        );
      })}
    </Stack>
  );
}
