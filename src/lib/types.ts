// Shapes of the Moodle web service responses this app uses.
// Only the fields the app reads are listed; Moodle returns more.

export interface SiteInfo {
  userid: number;
  username: string;
  firstname: string;
  fullname: string;
  sitename: string;
  siteurl: string;
}

export interface EnrolledCourse {
  id: number;
  fullname: string;
  shortname: string;
  summary: string;
  category: number;
  courseimage?: string;
  progress: number | null; // 0–100, or null when completion tracking is off
  visible?: number; // 0 when hidden from students
  completed?: boolean;
}

export interface Course {
  id: number;
  fullname: string;
  summary: string;
  categoryid: number;
  categoryname: string;
  courseimage?: string;
  visible: number; // 0 when hidden from students
}

export interface Category {
  id: number;
  name: string;
  description: string;
  parent: number;
  coursecount: number;
  sortorder: number;
  visible: number; // 0 when hidden from students
}

export interface CompletionData {
  state: 0 | 1 | 2 | 3; // 0 incomplete, 1 complete, 2 complete and passed, 3 complete and failed
  hascompletion: boolean;
  isautomatic: boolean;
}

export interface CourseModule {
  id: number;
  name: string;
  modname: string;
  url?: string;
  modicon: string;
  description?: string; // Labels carry their content here
  visible: number; // 0 when hidden from students
  uservisible: boolean; // Whether *this user* may open it (admins and teachers can open hidden ones)
  completiondata?: CompletionData;
}

export interface CourseSection {
  id: number;
  name: string;
  summary: string;
  section: number;
  visible?: number; // 0 when hidden from students
  uservisible?: boolean;
  modules: CourseModule[];
}

// One activity, from core_course_get_course_module.
export interface CourseModuleInfo {
  id: number;
  course: number;
  name: string;
  modname: string;
  instance: number;
}

export interface MoodlePage {
  id: number;
  coursemodule: number;
  name: string;
  intro: string;
  content: string;
}

export interface MoodleUrl {
  id: number;
  coursemodule: number;
  name: string;
  intro: string;
  externalurl: string;
}

export interface MoodleAssignment {
  id: number;
  cmid: number;
  name: string;
  intro: string;
  duedate: number;                    // Unix seconds, 0 when there is no due date
  cutoffdate?: number;                // No submissions after this (0 = none)
  submissiondrafts: number;           // 1: learners save drafts, then press "Submit for grading"
  requiresubmissionstatement: number; // 1: learners must agree to a statement when submitting
  submissionstatement?: string;       // The statement's text (newer Moodle versions send it)
  // Which submission types are switched on, e.g. { plugin: 'onlinetext', subtype: 'assignsubmission', name: 'enabled', value: '1' }
  configs: { plugin: string; subtype: string; name: string; value: string }[];
}

// From mod_assign_get_submission_status: where this learner's submission stands.
export interface AssignSubmissionPlugin {
  type: string; // 'onlinetext', 'file', 'comments' (feedback)…
  editorfields?: { name: string; text: string; format: number }[];
  fileareas?: { area: string; files?: { filename: string; fileurl: string }[] }[];
}

export interface AssignSubmissionStatus {
  lastattempt?: {
    submission?: {
      id: number;
      status: 'new' | 'draft' | 'submitted' | 'reopened';
      timemodified: number;
      plugins?: AssignSubmissionPlugin[];
    };
    submissionsenabled: boolean;
    locked: boolean;
    graded: boolean;
    canedit: boolean;   // May change the submission now
    cansubmit: boolean; // May press "Submit for grading" now
    gradingstatus?: string;
  };
  feedback?: {
    gradefordisplay?: string;
    gradeddate?: number;
    plugins?: AssignSubmissionPlugin[];
  };
}

// Moodle answers save/submit calls with a list of warnings; an empty list means it worked.
export interface MoodleWarning {
  item?: string;
  warningcode?: string;
  message: string;
}

// An "action event" from Moodle's calendar: something the learner needs to do by a date,
// e.g. an assignment due date. Moodle drops the event once it's done (e.g. submitted).
export interface CalendarActionEvent {
  id: number;
  name: string;          // e.g. "Accessibility audit is due"
  activityname: string;  // e.g. "Accessibility audit"
  modulename: string;    // e.g. "assign"
  eventtype: string;     // e.g. "due", "expectcompletionon"
  timesort: number;      // Unix seconds: the date that matters (due date, expected completion…)
  url: string;           // The activity in Moodle: .../mod/assign/view.php?id=<cmid>
  course: { id: number; fullname: string };
  action?: { name: string; actionable: boolean };
}

export interface MoodleException {
  exception: string;
  errorcode: string;
  message: string;
}
