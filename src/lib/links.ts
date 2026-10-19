// Rewrites links to Moodle so learners stay in this app.
// Shared by SafeHtml (links inside Moodle content) and pages that link to activities.

export function activityHref(courseid: number, cmid: number): string {
  return `/courses/${courseid}/activities/${cmid}`;
}

function moodleOrigin(): string | undefined {
  try {
    return process.env.MOODLE_URL ? new URL(process.env.MOODLE_URL).origin : undefined;
  } catch {
    return undefined;
  }
}

// Turns a Moodle address into this app's equivalent, or returns undefined if there is none.
export function appHrefFor(moodleHref: string): string | undefined {
  const origin = moodleOrigin();
  let url: URL;
  try {
    url = new URL(moodleHref);
  } catch {
    return undefined;
  }
  if (!origin || url.origin !== origin) {
    return undefined;
  }
  const id = Number(url.searchParams.get('id'));
  if (url.pathname.endsWith('/course/view.php') && Number.isInteger(id)) {
    return `/courses/${id}`;
  }
  if (url.pathname.endsWith('/my/') || url.pathname.endsWith('/my/index.php') || url.pathname.endsWith('/my/courses.php')) {
    return '/dashboard';
  }
  if (url.pathname.endsWith('/course/index.php')) {
    return '/catalogue';
  }
  // /mod/<type>/view.php?id=<cmid>: the course isn't in the URL, so go through a small redirect route.
  if (/\/mod\/\w+\/view\.php$/.test(url.pathname) && Number.isInteger(id)) {
    return `/activities/${id}`;
  }
  return undefined;
}
