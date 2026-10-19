'use client';

import NextLink, { type LinkProps as NextLinkProps } from 'next/link';
import type { Ref } from 'react';

// Lets MUI's Link and Button use Next.js navigation (no full page reload) for app routes.
// Set as the default link component in theme.ts, so <Link href="/dashboard"> just works.
export function LinkBehaviour({ ref, ...props }: Omit<NextLinkProps, 'href'> & {
  href: string;
  ref?: Ref<HTMLAnchorElement>;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <NextLink ref={ref} {...props} />;
}
