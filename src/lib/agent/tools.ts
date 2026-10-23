import 'server-only';
import sanitizeHtml from 'sanitize-html';
import { moodle, MoodleError } from '@/lib/moodle';
import { activityHref } from '@/lib/links';
import { loadUpNext } from '@/lib/upNext.server';
import { aiConfigured, aiFetch, ensureIndexed } from '@/lib/ai.server';
import { toAssignmentView, STATUS_LABEL } from '@/lib/assignment';
import type { AgentTool } from './run';
import { ToolUserError } from './run';
import { clip, intArg, strArg } from './args';

// The assistant's tools. Every one calls Moodle with the learner's own token, so Moodle decides
// what they may see, exactly as on the normal pages. All of them only read; none change anything.

export interface ToolContext {
  token: string;
  userid: number;
}

const courseIdSchema = { type: 'integer', description: 'The course id, from list_my_courses.' } as const;

// HTML from Moodle → readable text for the model.
function toText(html: string): string {
  const withBreaks = html.replace(/<\/(p|div|h[1-6]|li|tr|pre)>|<br\s*\/?>/gi, '\n').replace(/<li[^>]*>/gi, '- ');
  return sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n').trim();
}

async function visibleCourses(ctx: ToolContext) {
  return moodle.myCourses(ctx.token, ctx.userid); // Hidden courses are already left out
}

// The learner's view of one course. Moodle refuses it if they aren't enrolled.
async function learnerCourse(ctx: ToolContext, courseid: number) {
  const [course, sections] = await Promise.all([
    moodle.course(ctx.token, courseid),
    moodle.courseContents(ctx.token, courseid).catch((e: unknown) => (e instanceof MoodleError ? null : Promise.reject(e))),
  ]);
  if (!course || !sections) {
    throw new ToolUserError(`The learner isn't enrolled in course ${courseid}, or it doesn't exist.`);
  }
  return { course, sections };
}

export const assistantTools: AgentTool<ToolContext>[] = [
  {
    name: 'list_my_courses',
    description: 'The courses the learner is enrolled in, with their ids and progress. Use this first to find a course id.',
    input_schema: { type: 'object', properties: {} },
    kind: 'read',
    label: () => 'Looking up your courses',
    async run(_input, ctx) {
      return (await visibleCourses(ctx)).map((c) => ({
        course_id: c.id, name: c.fullname, progress_percent: c.progress === null ? null : Math.round(c.progress), link: `/courses/${c.id}`,
      }));
    },
  },
  {
    name: 'get_upcoming_deadlines',
    description: 'Deadlines across all the learner\'s courses: overdue (last 2 weeks) and due in the next 4 weeks, soonest first.',
    input_schema: { type: 'object', properties: {} },
    kind: 'read',
    label: () => 'Checking your deadlines',
    async run(_input, ctx) {
      const ids = visibleCourses(ctx).then((list) => new Set(list.map((c) => c.id)));
      const items = await loadUpNext(ctx.token, ids);
      if (items === null) throw new ToolUserError("Moodle's calendar couldn't be reached.");
      return items.map((i) => ({ activity: i.title, course: i.course, what: i.what, when: i.dueText, group: i.group, link: i.href }));
    },
  },
  {
    name: 'get_course_overview',
    description: 'One course\'s sections and activities, with what the learner has done. Use for progress, "what\'s left", or finding an activity.',
    input_schema: { type: 'object', properties: { course_id: courseIdSchema }, required: ['course_id'] },
    kind: 'read',
    label: () => 'Looking at the course',
    async run(input, ctx) {
      const { course, sections } = await learnerCourse(ctx, intArg(input, 'course_id'));
      const activities = sections.flatMap((s) => s.modules);
      const tracked = activities.filter((m) => m.completiondata?.hascompletion);
      const done = tracked.filter((m) => (m.completiondata?.state ?? 0) > 0).length;
      return {
        course: course.fullname,
        link: `/courses/${course.id}`,
        progress: tracked.length ? `${done} of ${tracked.length} done` : 'not tracked',
        sections: sections.map((s) => ({
          section: s.name,
          activities: s.modules.filter((m) => m.modname !== 'label').map((m) => ({
            cmid: m.id,
            name: m.name,
            type: m.modname,
            status: !m.completiondata?.hascompletion ? 'not tracked' : m.completiondata.state > 0 ? 'done' : 'to do',
            link: m.url ? activityHref(course.id, m.id) : `/courses/${course.id}`,
          })),
        })),
      };
    },
  },
  {
    name: 'search_course_content',
    description: 'Searches the text of one course (pages, assignment briefs, summaries) by meaning. Use to answer questions about what a course teaches.',
    input_schema: {
      type: 'object',
      properties: { course_id: courseIdSchema, query: { type: 'string', description: 'What to look for, in a few words or a question.' } },
      required: ['course_id', 'query'],
    },
    kind: 'read',
    label: (input) => `Searching the course for "${String(input.query ?? '').slice(0, 40)}"`,
    async run(input, ctx) {
      if (!aiConfigured()) throw new ToolUserError('Course search isn\'t set up on this site.');
      const courseid = intArg(input, 'course_id');
      const query = strArg(input, 'query');
      const { course, sections } = await learnerCourse(ctx, courseid);
      await ensureIndexed(ctx.token, course, sections);
      const response = await aiFetch(`/courses/${courseid}/search`, {
        method: 'POST',
        // Only what this learner can see; 0 = course and section summaries.
        body: JSON.stringify({ query, allowed_cmids: [0, ...sections.flatMap((s) => s.modules.map((m) => m.id))], limit: 5 }),
      });
      if (!response.ok) throw new Error(`Search failed: ${response.status}`);
      const { results } = await response.json() as { results: { title: string; section: string; href: string; text: string }[] };
      if (results.length === 0) return { results: [], note: 'Nothing in this course matches. Say so rather than guessing.' };
      return { results: results.map((r) => ({ from: r.title, section: r.section, link: r.href, text: r.text })) };
    },
  },
  {
    name: 'get_activity',
    description: 'The full content of one activity: a page\'s text, an assignment\'s brief, due date and the learner\'s submission status, or a link\'s address.',
    input_schema: {
      type: 'object',
      properties: { course_id: courseIdSchema, cmid: { type: 'integer', description: 'The activity id (cmid), from get_course_overview.' } },
      required: ['course_id', 'cmid'],
    },
    kind: 'read',
    label: () => 'Opening the activity',
    async run(input, ctx) {
      const courseid = intArg(input, 'course_id');
      const cmid = intArg(input, 'cmid');
      const { course, sections } = await learnerCourse(ctx, courseid);
      // Only activities the learner can see in their own view of the course.
      const m = sections.flatMap((s) => s.modules).find((x) => x.id === cmid);
      if (!m) throw new ToolUserError(`There's no activity ${cmid} the learner can see in this course.`);
      const base = { name: m.name, type: m.modname, link: m.url ? activityHref(course.id, m.id) : `/courses/${course.id}` };

      if (m.modname === 'page') {
        const page = await moodle.page(ctx.token, courseid, cmid);
        return { ...base, text: clip(toText(`${page?.intro ?? ''}${page?.content ?? ''}`)) };
      }
      if (m.modname === 'assign') {
        const a = await moodle.assignment(ctx.token, courseid, cmid);
        if (!a) return base;
        const status = await moodle.submissionStatus(ctx.token, a.id).catch(() => null);
        return {
          ...base,
          brief: clip(toText(a.intro)),
          due: a.duedate ? new Date(a.duedate * 1000).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/London' }) : 'no due date',
          submission: status ? STATUS_LABEL[toAssignmentView(a, status).status] : 'unknown',
        };
      }
      if (m.modname === 'url') {
        const u = await moodle.url(ctx.token, courseid, cmid);
        return { ...base, description: clip(toText(u?.intro ?? '')), address: u?.externalurl };
      }
      return { ...base, description: m.description ? clip(toText(m.description)) : undefined, note: 'This type opens in Moodle.' };
    },
  },
];
