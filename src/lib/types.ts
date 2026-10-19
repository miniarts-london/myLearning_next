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
  duedate: number; // Unix seconds, 0 when there is no due date
}

export interface MoodleException {
  exception: string;
  errorcode: string;
  message: string;
}
