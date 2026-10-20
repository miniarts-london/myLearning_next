// A small stand-in for Moodle's web services, so the end-to-end tests don't depend on your
// real Moodle or change its data. It answers only the calls this app makes, with fixed data:
//
//   Web Development        Accessible Web Design (id 2)  enrolled, 2 sections, completion tracked
//                          Secret course (id 4)           hidden: must never appear
//   Personal Development   Horse Care Essentials (id 3)   not enrolled
//   Hidden category (id 3) hidden: must never appear
//
// Log in with username "student" and password "secret".
// POST /__reset puts completion back to the starting state; tests call it before each test.
import http from 'node:http';

const PORT = Number(process.env.MOCK_MOODLE_PORT ?? 8099);
const BASE = `http://localhost:${PORT}`;
const TOKEN = 'test-token';

const INITIAL_DONE = [11]; // "Accessibility and WCAG" starts done
let done = new Set(INITIAL_DONE);

// The learner's submission for assignment 1 ("Assignment: Accessibility audit", cmid 13).
// It uses drafts and a submission statement, and takes online text and files.
const newSubmission = () => ({ status: 'new', html: '', timemodified: 0 });
let submission = newSubmission();
const STATEMENT = 'This submission is my own work, except where I have acknowledged the use of the works of other people.';

const tracked = (id, isautomatic = false) => ({ state: done.has(id) ? 1 : 0, hascompletion: true, isautomatic });
const mod = (id, name, modname, extra = {}) => ({
  id, name, modname, url: `${BASE}/mod/${modname}/view.php?id=${id}`, modicon: '', visible: 1, uservisible: true, ...extra,
});

const contents = () => [
  { id: 1, section: 1, name: 'Why accessibility matters', summary: '<p>What accessibility is and why it matters.</p>', visible: 1, uservisible: true, modules: [
    mod(11, 'Accessibility and WCAG', 'page', { completiondata: tracked(11) }),
    mod(12, 'WCAG overview (W3C)', 'url'),
    mod(13, 'Assignment: Accessibility audit', 'assign', { completiondata: tracked(13) }),
  ] },
  { id: 2, section: 2, name: 'Semantic HTML', summary: '', visible: 1, uservisible: true, modules: [
    { id: 20, name: 'Intro label', modname: 'label', description: '<p>Use the right element for the job.</p>', modicon: '', visible: 1, uservisible: true },
    mod(21, 'Use the right element', 'page', { completiondata: tracked(21) }),
    mod(22, 'Semantics quiz', 'quiz', { completiondata: tracked(22, true) }),
    mod(23, 'Hidden draft page', 'page', { visible: 0 }), // hidden from students; admins still get it
  ] },
  { id: 3, section: 3, name: 'Hidden section', summary: '', visible: 0, uservisible: true, modules: [
    mod(31, 'Activity in a hidden section', 'page'),
  ] },
];

const trackedIds = [11, 13, 21, 22];
const progress = () => Math.round((100 * trackedIds.filter((id) => done.has(id)).length) / trackedIds.length);

const courses = [
  { id: 2, fullname: 'Accessible Web Design', shortname: 'AWD101', summary: '<p>Build websites everyone can use.</p>', categoryid: 1, categoryname: 'Web Development', visible: 1 },
  { id: 3, fullname: 'Horse Care Essentials', shortname: 'HORSE101', summary: '<p>Everyday care for horses.</p>', categoryid: 2, categoryname: 'Personal Development', visible: 1 },
  { id: 4, fullname: 'Secret course', shortname: 'SECRET', summary: '', categoryid: 1, categoryname: 'Web Development', visible: 0 },
];
const categories = [
  { id: 1, name: 'Web Development', description: '', parent: 0, coursecount: 2, sortorder: 1, visible: 1 },
  { id: 2, name: 'Personal Development', description: '', parent: 0, coursecount: 1, sortorder: 2, visible: 1 },
  { id: 3, name: 'Hidden category', description: '', parent: 0, coursecount: 0, sortorder: 3, visible: 0 },
];

// Calendar "action events" (what Moodle's Timeline block shows). Times are relative to now.
const HOUR = 3600;
const events = () => {
  const now = Math.floor(Date.now() / 1000);
  const event = (id, cmid, activityname, modulename, eventtype, timesort, course = { id: 2, fullname: 'Accessible Web Design' }) => ({
    id, name: `${activityname} is due`, activityname, modulename, eventtype, timesort,
    url: `${BASE}/mod/${modulename}/view.php?id=${cmid}`, course, action: { name: 'View', actionable: true },
  });
  return [
    event(101, 13, 'Assignment: Accessibility audit', 'assign', 'due', now + 4 * 24 * HOUR),
    event(102, 21, 'Use the right element', 'page', 'expectcompletionon', now - 2 * 24 * HOUR), // overdue
    event(103, 22, 'Semantics quiz', 'quiz', 'close', now + 24 * HOUR),
    event(104, 13, 'Final project', 'assign', 'due', now + 20 * 24 * HOUR),
    event(105, 99, 'Secret assignment', 'assign', 'due', now + 2 * 24 * HOUR, { id: 4, fullname: 'Secret course' }), // hidden course
  ]
    .filter((e) => !done.has(Number(new URL(e.url).searchParams.get('id'))) || e.id === 104)
    .filter((e) => !(e.id === 101 && submission.status === 'submitted')); // Moodle drops a deadline once it's submitted
};
let calendarDown = false; // POST /__calendar-down makes the calendar fail, to test the fallback

const exception = (errorcode, message) => ({ exception: 'moodle_exception', errorcode, message });

function webService(fn, p) {
  switch (fn) {
    case 'core_webservice_get_site_info':
      return { userid: 5, username: 'student', firstname: 'Sam', fullname: 'Sam Student', sitename: 'Test Moodle', siteurl: BASE };
    case 'core_enrol_get_users_courses':
      return [
        { id: 2, fullname: 'Accessible Web Design', shortname: 'AWD101', summary: '', category: 1, progress: progress(), visible: 1 },
        { id: 4, fullname: 'Secret course', shortname: 'SECRET', summary: '', category: 1, progress: 0, visible: 0 },
      ];
    case 'core_course_get_courses_by_field': {
      const id = p.get('value');
      return { courses: id ? courses.filter((c) => String(c.id) === id) : courses };
    }
    case 'core_course_get_categories':
      return categories;
    case 'core_course_get_contents': {
      const id = p.get('courseid');
      if (id === '2' || id === '4') return id === '2' ? contents() : [];
      return exception('requireloginerror', 'Course or activity not accessible.');
    }
    case 'core_course_get_course_module': {
      const cmid = Number(p.get('cmid'));
      const m = contents().flatMap((s) => s.modules).find((x) => x.id === cmid);
      return m ? { cm: { id: m.id, course: 2, name: m.name, modname: m.modname, instance: m.id } } : exception('invalidrecord', 'Can not find data record in database.');
    }
    case 'mod_page_get_pages_by_courses':
      return { pages: [
        { id: 1, coursemodule: 11, name: 'Accessibility and WCAG', intro: '',
          content: `<p>WCAG has four principles. Try <a href="${BASE}/mod/assign/view.php?id=13">the audit</a> and read <a href="https://www.w3.org/WAI/">the W3C site</a>.</p><pre><code>const ok = true;</code></pre>` },
        { id: 2, coursemodule: 21, name: 'Use the right element', intro: '', content: '<p>Use a button for actions and a link for navigation.</p>' },
      ] };
    case 'mod_url_get_urls_by_courses':
      return { urls: [{ id: 1, coursemodule: 12, name: 'WCAG overview (W3C)', intro: '<p>The official overview.</p>', externalurl: 'https://www.w3.org/WAI/standards-guidelines/wcag/' }] };
    case 'mod_assign_get_assignments':
      return { courses: [{ assignments: [{
        id: 1, cmid: 13, name: 'Assignment: Accessibility audit', intro: '<p>Audit a web page against five WCAG criteria.</p>',
        duedate: Math.floor(Date.now() / 1000) + 4 * 86400, cutoffdate: 0,
        submissiondrafts: 1, requiresubmissionstatement: 1, submissionstatement: STATEMENT,
        configs: [
          { plugin: 'onlinetext', subtype: 'assignsubmission', name: 'enabled', value: '1' },
          { plugin: 'file', subtype: 'assignsubmission', name: 'enabled', value: '1' },
        ],
      }] }] };
    case 'mod_assign_get_submission_status': {
      const submitted = submission.status === 'submitted';
      return {
        lastattempt: {
          submission: { id: 1, status: submission.status, timemodified: submission.timemodified, plugins: [
            { type: 'onlinetext', editorfields: [{ name: 'onlinetext', text: submission.html, format: 1 }] },
            { type: 'file', fileareas: [{ area: 'submission_files', files: [] }] },
          ] },
          submissionsenabled: true, locked: false, graded: false,
          canedit: !submitted, cansubmit: submission.status === 'draft',
        },
      };
    }
    case 'mod_assign_save_submission': {
      if (submission.status === 'submitted') return [{ item: 'assignment', warningcode: 'couldnotsavesubmission', message: 'This submission has already been submitted for grading and cannot be changed.' }];
      submission = { status: 'draft', html: p.get('plugindata[onlinetext_editor][text]') ?? '', timemodified: Math.floor(Date.now() / 1000) };
      return [];
    }
    case 'mod_assign_submit_for_grading': {
      if (p.get('acceptsubmissionstatement') !== '1') return [{ item: 'assignment', warningcode: 'couldnotsubmitforgrading', message: 'You must accept the submission statement.' }];
      submission = { ...submission, status: 'submitted', timemodified: Math.floor(Date.now() / 1000) };
      return [];
    }
    case 'core_calendar_get_action_events_by_timesort': {
      if (calendarDown) return exception('servicenotavailable', 'Web service is not available');
      const from = Number(p.get('timesortfrom')), to = Number(p.get('timesortto'));
      return { events: events().filter((e) => e.timesort >= from && e.timesort <= to) };
    }
    case 'core_completion_update_activity_completion_status_manually': {
      const cmid = Number(p.get('cmid'));
      if (p.get('completed') === '1') done.add(cmid); else done.delete(cmid);
      return { status: true, warnings: [] };
    }
    default:
      return exception('nofunction', `Mock Moodle doesn't implement ${fn}`);
  }
}

http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    const p = new URLSearchParams(body);
    const json = (data) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
    const url = req.url ?? '';

    if (url.startsWith('/__reset')) { done = new Set(INITIAL_DONE); calendarDown = false; submission = newSubmission(); return json({ ok: true }); }
    if (url.startsWith('/__calendar-down')) { calendarDown = true; return json({ ok: true }); }
    if (url.startsWith('/login/token.php')) {
      return p.get('username') === 'student' && p.get('password') === 'secret'
        ? json({ token: TOKEN })
        : json({ error: 'Invalid login, please try again', errorcode: 'invalidlogin' });
    }
    if (url.startsWith('/webservice/rest/server.php')) {
      if (p.get('wstoken') !== TOKEN) return json(exception('invalidtoken', 'Invalid token - token not found'));
      return json(webService(p.get('wsfunction'), p));
    }
    res.statusCode = 404;
    res.end('Not found');
  });
}).listen(PORT, () => console.log(`Mock Moodle on ${BASE}`));
