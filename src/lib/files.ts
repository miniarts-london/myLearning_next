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

// The picture for courses that have no image of their own. To use your own photo, put it in
// public/images (e.g. public/images/course-default.jpg) and change this path to match.
export const DEFAULT_COURSE_IMAGE = '/images/course-default.jpg';

// Moodle makes up a patterned placeholder for a course with no uploaded image: sent inline as a
// data: SVG, or as a generated file (…/course/generated/…). Those count as "no image".
export function isGeneratedCourseImage(url: string): boolean {
  return url.startsWith('data:image/svg+xml') || url.includes('/course/generated/');
}

// The course's own image (through /api/file), or the default picture.
export function courseImageUrl(moodleUrl: string | undefined): string {
  if (!moodleUrl || isGeneratedCourseImage(moodleUrl)) {
    return DEFAULT_COURSE_IMAGE;
  }
  return fileUrl(moodleUrl) ?? DEFAULT_COURSE_IMAGE;
}
