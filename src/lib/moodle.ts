import 'server-only';
import type {
  Category, Course, CourseModuleInfo, CourseSection, EnrolledCourse, MoodleAssignment,
  MoodleException, MoodlePage, MoodleUrl, SiteInfo,
} from './types';

// A small typed client for Moodle's REST web services (/webservice/rest/server.php).
// Server only: the token never reaches the browser.

type Params = Record<string, unknown>;

export class MoodleError extends Error {
  constructor(public errorcode: string, message: string) {
    super(message);
    this.name = 'MoodleError';
  }
}

export function moodleUrl(path = ''): string {
  const base = process.env.MOODLE_URL;
  if (!base) {
    throw new Error('MOODLE_URL is not set. Copy .env.example to .env.local and fill it in.');
  }
  return base.replace(/\/+$/, '') + path;
}

// Moodle wants nested values flattened: {courseids: [2, 3]} becomes courseids[0]=2&courseids[1]=3.
function flatten(params: Params, prefix = '', out = new URLSearchParams()): URLSearchParams {
  for (const [key, value] of Object.entries(params)) {
    const name = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === 'object') {
      flatten(value as Params, name, out);
    } else {
      out.append(name, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
    }
  }
  return out;
}

function isException(data: unknown): data is MoodleException {
  return typeof data === 'object' && data !== null && 'exception' in data;
}

export async function call<T>(token: string, wsfunction: string, params: Params = {}): Promise<T> {
  const body = flatten(params);
  body.set('wstoken', token);
  body.set('wsfunction', wsfunction);
  body.set('moodlewsrestformat', 'json');

  const res = await fetch(moodleUrl('/webservice/rest/server.php'), {
    method: 'POST',
    body,
    cache: 'no-store', // Per-user data: never share it between users.
  });
  if (!res.ok) {
    throw new MoodleError('httperror', `Moodle returned HTTP ${res.status}`);
  }
  const data: unknown = await res.json();
  // Moodle reports errors as a normal 200 response with an "exception" field.
  if (isException(data)) {
    throw new MoodleError(data.errorcode, data.message);
  }
  return data as T;
}

// Exchange a username and password for this user's token, through Moodle's mobile app service.
export async function getToken(username: string, password: string): Promise<string> {
  const res = await fetch(moodleUrl('/login/token.php'), {
    method: 'POST',
    body: new URLSearchParams({ username, password, service: process.env.MOODLE_SERVICE ?? 'moodle_mobile_app' }),
    cache: 'no-store',
  });
  const data = (await res.json()) as { token?: string; error?: string; errorcode?: string };
  if (!data.token) {
    throw new MoodleError(data.errorcode ?? 'invalidlogin', data.error ?? 'Invalid login, please try again.');
  }
  return data.token;
}

// One function per web service the app uses, so pages read like plain function calls.
export const moodle = {
  siteInfo: (token: string) => call<SiteInfo>(token, 'core_webservice_get_site_info'),

  myCourses: (token: string, userid: number) =>
    call<EnrolledCourse[]>(token, 'core_enrol_get_users_courses', { userid }),

  allCourses: async (token: string) =>
    (await call<{ courses: Course[] }>(token, 'core_course_get_courses_by_field')).courses
      .filter((course) => course.categoryid !== 0), // Leave out the site home "course".

  categories: (token: string) => call<Category[]>(token, 'core_course_get_categories'),

  course: async (token: string, id: number) =>
    (await call<{ courses: Course[] }>(token, 'core_course_get_courses_by_field', { field: 'id', value: id })).courses[0],

  courseContents: (token: string, courseid: number) =>
    call<CourseSection[]>(token, 'core_course_get_contents', { courseid }),

  courseModule: async (token: string, cmid: number) =>
    (await call<{ cm: CourseModuleInfo }>(token, 'core_course_get_course_module', { cmid })).cm,

  // The mod_* functions return every activity of that type in the course; pick the one we want.
  page: async (token: string, courseid: number, cmid: number) =>
    (await call<{ pages: MoodlePage[] }>(token, 'mod_page_get_pages_by_courses', { courseids: [courseid] }))
      .pages.find((p) => p.coursemodule === cmid),

  url: async (token: string, courseid: number, cmid: number) =>
    (await call<{ urls: MoodleUrl[] }>(token, 'mod_url_get_urls_by_courses', { courseids: [courseid] }))
      .urls.find((u) => u.coursemodule === cmid),

  assignment: async (token: string, courseid: number, cmid: number) =>
    (await call<{ courses: { assignments: MoodleAssignment[] }[] }>(token, 'mod_assign_get_assignments', { courseids: [courseid] }))
      .courses[0]?.assignments.find((a) => a.cmid === cmid),

  setManualCompletion: (token: string, cmid: number, completed: boolean) =>
    call<{ status: boolean }>(token, 'core_completion_update_activity_completion_status_manually', { cmid, completed }),
};
