import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Postgres inside the app for local work and tests (no DATABASE_URL); it ships WebAssembly
  // files, so it's loaded from node_modules as is rather than bundled.
  serverExternalPackages: ['@electric-sql/pglite'],
  // An assignment's submissions used to have their own page; they now open in a drawer on the
  // course's Assignments tab. Older links still work.
  async redirects() {
    return [{
      source: '/courses/:id(\\d+)/activities/:cmid(\\d+)/submissions',
      destination: '/courses/:id/submissions?assignment=:cmid',
      permanent: false,
    }];
  },
};

export default nextConfig;
