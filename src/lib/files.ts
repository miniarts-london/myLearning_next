// Moodle file links (course images, images in descriptions) need the user's token.
// Pages point them at /api/file instead, which adds the token on the server.
export function fileUrl(moodleFileUrl: string | undefined): string | undefined {
  if (!moodleFileUrl) {
    return undefined;
  }
  return `/api/file?url=${encodeURIComponent(moodleFileUrl)}`;
}
