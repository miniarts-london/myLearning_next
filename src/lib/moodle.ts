import 'server-only';
import { cache } from 'react';
import type {
  ActivityCompletionStatus, CourseUser,
  AssignSubmissionStatus, CalendarActionEvent, Category, Course, CourseModuleInfo, MoodleWarning, CourseSection, EnrolledCourse, MoodleAssignment,
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

// This is a learner-facing app, so it shows what a student sees. Moodle returns hidden
// courses, categories, sections and activities to admins and teachers (they're allowed
// to see them), so they're filtered out here, in one place, for everyone.
const shown = <T extends { visible?: number }>(item: T) => item.visible !== 0;

function learnerView(sections: CourseSection[]): CourseSection[] {
  return sections
    .filter((s) => shown(s) && s.uservisible !== false)
    .map((s) => ({ ...s, modules: s.modules.filter((m) => shown(m) && m.uservisible) }));
}

// One function per web service the app uses, so pages read like plain function calls.
export const moodle = {
  // cache(): several parts of a page can ask (e.g. "is this user a site admin?"); Moodle is asked once.
  siteInfo: cache((token: string) => call<SiteInfo>(token, 'core_webservice_get_site_info')),

  myCourses: async (token: string, userid: number) =>
    (await call<EnrolledCourse[]>(token, 'core_enrol_get_users_courses', { userid })).filter(shown),

  allCourses: async (token: string) =>
    (await call<{ courses: Course[] }>(token, 'core_course_get_courses_by_field')).courses
      .filter((course) => course.categoryid !== 0 && shown(course)), // Leave out the site home "course".

  categories: async (token: string) =>
    (await call<Category[]>(token, 'core_course_get_categories')).filter(shown),

  // undefined when the course doesn't exist or is hidden, so the page shows "not found".
  // cache(): the course layout (course index) and the page both ask for this in the same
  // request; Moodle is only called once.
  course: cache(async (token: string, id: number) =>
    (await call<{ courses: Course[] }>(token, 'core_course_get_courses_by_field', { field: 'id', value: id }))
      .courses.find(shown)),

  courseContents: cache(async (token: string, courseid: number) =>
    learnerView(await call<CourseSection[]>(token, 'core_course_get_contents', { courseid }))),

  courseModule: async (token: string, cmid: number) =>
    (await call<{ cm: CourseModuleInfo }>(token, 'core_course_get_course_module', { cmid })).cm,

  // The mod_* functions return every activity of that type in the course; pick the one we want.
  // Every page, URL or assignment in a course (Moodle returns them per course, not per activity).
  pages: async (token: string, courseid: number) =>
    (await call<{ pages: MoodlePage[] }>(token, 'mod_page_get_pages_by_courses', { courseids: [courseid] })).pages,

  urls: async (token: string, courseid: number) =>
    (await call<{ urls: MoodleUrl[] }>(token, 'mod_url_get_urls_by_courses', { courseids: [courseid] })).urls,

  assignments: async (token: string, courseid: number) =>
    (await call<{ courses: { assignments: MoodleAssignment[] }[] }>(token, 'mod_assign_get_assignments', { courseids: [courseid] }))
      .courses[0]?.assignments ?? [],

  // One activity of each kind, picked out of the course's list.
  page: async (token: string, courseid: number, cmid: number) =>
    (await moodle.pages(token, courseid)).find((p) => p.coursemodule === cmid),

  url: async (token: string, courseid: number, cmid: number) =>
    (await moodle.urls(token, courseid)).find((u) => u.coursemodule === cmid),

  assignment: async (token: string, courseid: number, cmid: number) =>
    (await moodle.assignments(token, courseid)).find((a) => a.cmid === cmid),

  // Where this learner's submission stands (status, text, files, grade and feedback).
  submissionStatus: (token: string, assignid: number) =>
    call<AssignSubmissionStatus>(token, 'mod_assign_get_submission_status', { assignid }),

  // Saves the learner's online text. Saved as a draft if the assignment uses drafts,
  // otherwise as their submission. `itemid: 0`: no files embedded in the text.
  saveOnlineText: (token: string, assignmentid: number, html: string) =>
    call<MoodleWarning[]>(token, 'mod_assign_save_submission', {
      assignmentid,
      plugindata: { onlinetext_editor: { text: html, format: 1, itemid: 0 } }, // format 1 = HTML
    }),

  // Hands a draft in for marking. After this the learner usually can't change it.
  submitForGrading: (token: string, assignmentid: number, acceptsubmissionstatement: boolean) =>
    call<MoodleWarning[]>(token, 'mod_assign_submit_for_grading', { assignmentid, acceptsubmissionstatement }),

  // Deadlines and other things to do across all the learner's courses, between two dates
  // (Unix seconds). This is what Moodle's own Timeline block uses.
  actionEvents: async (token: string, from: number, to: number) =>
    (await call<{ events: CalendarActionEvent[] }>(token, 'core_calendar_get_action_events_by_timesort', {
      timesortfrom: from, timesortto: to, limitnum: 50, limittononsuspendedevents: true,
    })).events,

  // For teachers and admins -------------------------------------------------------------
  // Moodle checks permissions on each of these. Note that students may also list a course's
  // participants (it's how they find classmates), so the app decides who sees the learner list:
  // see src/lib/staff.server.ts.

  // One person's profile in one course, including their roles there. [] when not enrolled.
  courseProfile: cache(async (token: string, userid: number, courseid: number) =>
    (await call<CourseUser[]>(token, 'core_user_get_course_user_profiles', { userlist: [{ userid, courseid }] }))[0]),

  // Everyone enrolled in a course, with their roles and when they last visited it.
  enrolledUsers: (token: string, courseid: number) =>
    call<CourseUser[]>(token, 'core_enrol_get_enrolled_users', {
      courseid,
      options: [{ name: 'userfields', value: 'id,fullname,roles,lastcourseaccess' }],
    }),

  // Every activity's completion for one user. Teachers may ask about their learners.
  completionFor: async (token: string, courseid: number, userid: number) =>
    (await call<{ statuses: ActivityCompletionStatus[] }>(token, 'core_completion_get_activities_completion_status', { courseid, userid }))
      .statuses,

  // Sends a Moodle message from this user to another (it appears in Moodle's messages and, depending
  // on their preferences, by email). Moodle reports per-message problems as msgid -1 plus a reason.
  sendMessage: async (token: string, touserid: number, text: string) => {
    const [result] = await call<{ msgid: number; errormessage?: string }[]>(token, 'core_message_send_instant_messages', {
      messages: [{ touserid, text, textformat: 2 }], // 2 = plain text
    });
    if (!result || result.msgid < 0) {
      throw new MoodleError('messagenotsent', result?.errormessage ?? 'The message could not be sent.');
    }
  },

  setManualCompletion: (token: string, cmid: number, completed: boolean) =>
    call<{ status: boolean }>(token, 'core_completion_update_activity_completion_status_manually', { cmid, completed }),
};
