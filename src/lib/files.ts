// Moodle file links (course images, images in descriptions) need the user's token.
// Pages point them at /api/file instead, which adds the token on the server.
export function fileUrl(moodleFileUrl: string | undefined): string | undefined {
  if (!moodleFileUrl) {
    return undefined;
  }
  // A course with no image gets a patterned placeholder from Moodle, sometimes sent inline as a
  // data: image. That can be used as it is: there's no file to fetch, and an <img> never runs
  // scripts. Only image types, though; any other data: address is dropped.
  if (moodleFileUrl.startsWith('data:')) {
    return /^data:image\/(png|jpeg|gif|webp|svg\+xml)[;,]/i.test(moodleFileUrl) ? moodleFileUrl : undefined;
  }
  return `/api/file?url=${encodeURIComponent(moodleFileUrl)}`;
}
