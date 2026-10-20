# MyLearning (Next.js + headless Moodle)

A modern front end for a Moodle site, built with **Next.js 16** (App Router, TypeScript). Moodle stays the back end: users, courses, enrolments, roles, completion and grades all live there, and this app reads and updates them through Moodle's web services API.

```
Browser ──► Next.js (this app)  ──server only──►  Moodle web services
            React pages              /login/token.php
            encrypted session        /webservice/rest/server.php
            /api/file proxy          /webservice/pluginfile.php
```

The user's Moodle token never reaches the browser. It is stored in an encrypted, httpOnly session cookie, and every Moodle call happens on the server. Moodle still enforces permissions, because each user's token carries their own Moodle rights.

## What it does

| Screen | Moodle web services |
| --- | --- |
| **Log in / log out** | `login/token.php` (service `moodle_mobile_app`), `core_webservice_get_site_info` |
| **Dashboard**: my courses with progress | `core_enrol_get_users_courses` |
| **Course page**: sections, activities, progress, *Mark as done* | `core_course_get_courses_by_field`, `core_course_get_contents`, `core_completion_update_activity_completion_status_manually` |
| **Course catalogue**: courses by category | `core_course_get_categories`, `core_course_get_courses_by_field` |
| **Images** (course images, images in descriptions) | `webservice/pluginfile.php`, through `/api/file` |

Activities open inside the app, at `/courses/<id>/activities/<cmid>`, with Previous / Next links and Mark as done. Pages, URLs and assignment descriptions are shown in the app. Other activity types (quizzes, forums, assignment submission) aren't built yet; their page offers a link that opens Moodle in a **new tab**, so the app stays open. Links to Moodle inside course content (to courses, activities, the dashboard) are rewritten to the app's own pages by `SafeHtml` and `src/lib/links.ts`.

## Set up

### 1. Moodle (as an administrator)

1. *Site administration > General > Advanced features*: tick **Enable web services** and **Enable web services for mobile devices**. The second one turns on Moodle's built-in `moodle_mobile_app` service, which lets each user get their own token by logging in.
2. *Site administration > Server > Web services > Manage protocols*: enable **REST protocol**.
3. Make sure users have the capability `moodle/webservice:createtoken` (the Authenticated user role has it by default when mobile web services are on).
4. For progress bars, turn on **completion tracking** (*Advanced features > Enable completion tracking*) and in each course's settings.

### 2. This app

Needs Node.js 20.9 or later.

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

| Variable | Value |
| --- | --- |
| `MOODLE_URL` | Your Moodle site, no trailing slash, e.g. `http://localhost:8080` |
| `MOODLE_SERVICE` | `moodle_mobile_app` (or your own external service's short name) |
| `SESSION_SECRET` | A random secret of at least 32 characters: `openssl rand -base64 32` |

Then:

```bash
npm run dev      # http://localhost:3000, reloads as you edit
npm run build    # production build
npm start        # run the production build
npm run lint
```

Log in with a Moodle username and password.

## Theme and colours

The whole UI is built with [Material UI](https://mui.com/material-ui/) (MUI 9) and its icons. Colours, fonts and default component styles live in one place, `src/theme.ts`:

- `palette.primary`: the brand colour (main buttons, menu and heading underlines, skip link, focus ring)
- `palette.secondary`: black (links, outline buttons)
- `palette.success`: green (progress bars, Done buttons)
- `typography`: the font and the h1–h3 heading styles
- `components`: defaults for MUI components, e.g. `MuiButton` hover colours, flat `MuiCard`s, standard `MuiTextField`s

Keep each colour's `contrastText` readable on it: at least 4.5:1 (white on the plum, black on a light yellow).

MUI's `Link`, and any `Button` or `CardActionArea` with an `href`, go through Next.js routing (no full page reload) because the theme sets `LinkBehaviour` as their default link component. Links to other sites use `component="a"` with `target="_blank"`.

Page layout uses MUI too: `AppBar` and `Container` for the frame, `Typography` for text, `Card` for courses, `List` for activities, `Breadcrumbs`, `Alert` for notices, `Chip` for automatic completion, `TextField` on the login form. Small shared pieces are in `src/components/` (`SectionTitle`, `CourseGrid`, `CourseCard`, `ProgressBar`, `CompletionButton`, `Loading`).

`globals.css` is now short: the skip link, the focus ring, and styles for HTML that comes from Moodle (`SafeHtml`), which MUI components can't style.

The theme has `cssVariables: true`, so MUI publishes every value as a CSS variable (`--mui-palette-primary-main`…); `globals.css` uses those, so it always matches the theme. MUI 9 no longer accepts style shortcuts as props (`<Typography fontWeight={600}>`); put them in `sx` instead (`sx={{ fontWeight: 600 }}`).

`src/app/layout.tsx` wraps the app in `AppRouterCacheProvider` (collects MUI's styles during server rendering, so pages arrive already styled) and `ThemeProvider`. MUI components are client components, but server pages and screens can render them; data fetching and the Moodle token stay on the server.

## How the code is organised

```
src/
├── proxy.ts                         Redirects to /login when there's no session cookie (a quick check only)
├── lib/
│   ├── moodle.ts                    Typed Moodle client: call(), getToken(), and one function per web service
│   ├── types.ts                     Types for the Moodle responses the app uses
│   ├── session.ts                   Encrypted session cookie (jose, A256GCM): create, read, delete
│   ├── dal.ts                       verifySession(): the real auth check, used by every page and action
│   ├── files.ts                     fileUrl(): points Moodle file links at /api/file
│   └── links.ts                     Rewrites Moodle links to the app's own pages
├── theme.ts                         MUI theme: colours, font, button styles
├── actions/completion.ts            Mark as done Server Action
├── components/
│   ├── screens/                     One screen per page: Dashboard, Catalogue, Course, Activity, Login
│   ├── course-index/                The course index sidebar: CourseShell (open/close, phone drawer) and CourseIndex
│   └── …                            CourseCard, CourseGrid, SectionTitle, ProgressBar, CompletionButton,
│                                    NavLinks, SafeHtml, Loading, LinkBehaviour (MUI links → Next.js routing)
└── app/
    ├── login/                       Log in page, form (useActionState) and the login/logout Server Actions
    ├── (app)/layout.tsx             Header and navigation for logged-in pages
    ├── (app)/dashboard/             My courses
    ├── (app)/catalogue/             Courses by category
    ├── (app)/courses/[id]/          Course page, activities/[cmid]/ for each activity, and layout.tsx (course index)
    ├── (app)/activities/[cmid]/     Redirects Moodle activity links to the right course
    └── api/file/route.ts            Streams Moodle files with the token added on the server
```

**Assignments.** Learners write and submit online text answers in the app: save a draft, tick the submission statement if the assignment requires one, and submit for grading. Once submitted the work is shown read-only (or editable, if the assignment doesn't use drafts and Moodle allows changes), with the grade and feedback when marked. It uses `mod_assign_get_submission_status`, `mod_assign_save_submission` and `mod_assign_submit_for_grading`. Moodle makes every decision (open? allowed to edit?); the app only shows Moodle's answers as messages. The text is stored as HTML: what the learner types is escaped and blank lines become paragraphs (`lib/assignment.ts`). File uploads still go to Moodle in a new tab: they need Moodle's separate upload endpoint, which is a good next step.

**Up next.** The dashboard lists deadlines across all your courses: overdue (last 2 weeks), today, tomorrow, this week and later (up to 4 weeks ahead). They come from Moodle's calendar "action events" (`core_calendar_get_action_events_by_timesort`), the same data as Moodle's Timeline block, so an item disappears once Moodle counts it as done (an assignment submitted, an activity completed). The pure logic (grouping, dates, links) is in `lib/upNext.ts`; loading it is in `lib/upNext.server.ts`. If the calendar can't be reached, the dashboard still shows your courses. Dates are shown in `APP_TIME_ZONE` (default `Europe/London`). To see items in your own Moodle, give activities a due date, or set "Expect completed on" in an activity's completion settings.

**Course index.** `courses/[id]/layout.tsx` wraps the course page and all its activity pages, so the index stays put while you move between activities. It lists every section and activity (labels and hidden items left out), with completion ticks and the current activity highlighted. On wide screens it's a sidebar you can hide; the choice is remembered in the browser. On phones it's a drawer that closes when you pick an activity. The index and the page both need the course contents; `moodle.course()` and `moodle.courseContents()` are wrapped in React's `cache()`, so Moodle is only called once per request.

**Pages and screens.** Every page is split in two:

- `app/…/page.tsx` gets the data: checks the session, calls Moodle, handles "not found", and shapes the data. It never contains layout markup.
- `components/screens/<Name>.tsx` shows it: it receives plain, typed props and has no data fetching, so it's easy to read, restyle and test (for example with sample data in Storybook or a unit test).

To add a page, write the screen first with the props it needs, then a `page.tsx` that fetches those props and renders `<NameScreen … />`.

Design decisions:

- **The token stays on the server.** Pages are Server Components, changes are Server Actions, and files go through a Route Handler. The browser only ever has an encrypted cookie it cannot read.
- **The session is encrypted, not just signed**, because it holds the token. A signed cookie can be decoded by anyone who has it.
- **Cache Components (Next.js 16).** Each page's static shell (header, headings) is prerendered and loads instantly; the Moodle data streams in behind a `<Suspense>` boundary.
- **Moodle errors are real errors.** Moodle reports failures as a normal HTTP 200 with an `exception` field; `call()` turns those into a `MoodleError`.
- **Moodle HTML is sanitised** before rendering (`sanitize-html`), and Moodle image links are rewritten to `/api/file`.
- **`/api/file` only fetches from your Moodle** (same origin, `pluginfile.php` paths), so it can't be used as an open proxy.
- **No per-user data is cached on the server**: all Moodle requests use `cache: 'no-store'`.

## Adding a feature

1. Find the web service in Moodle: *Site administration > Server > Web services > API documentation* lists every function with its parameters and response.
2. Check it is in the `moodle_mobile_app` service (or add it to your own external service).
3. Add its response type to `lib/types.ts` and a function to the `moodle` object in `lib/moodle.ts`.
4. Call it from a Server Component (to read) or a Server Action (to change something).

Good next features: grades (`gradereport_user_get_grade_items`), badges (`core_badges_get_user_badges`), upcoming events (`core_calendar_get_calendar_upcoming_view`), and quizzes (`mod_quiz_*`).

## Testing

End-to-end tests in `e2e/` use [Playwright](https://playwright.dev): a real browser drives the real app, which talks to a **mock Moodle** (`e2e/mock-moodle.mjs`) instead of yours. The tests are repeatable and never change your Moodle's data.

```bash
npx playwright install chromium   # once: downloads the test browser
npm run test:e2e                  # builds the app, starts it and the mock Moodle, runs every test
npm run test:e2e:ui               # Playwright's UI: pick tests, watch them run, step back through each one
npx playwright show-report        # the HTML report from the last run
```

The app runs on port 3100 and the mock Moodle on 8099, so tests don't clash with `npm run dev` on 3000.

What's covered:

| File | Checks |
|---|---|
| `auth.spec.ts` | Login required; Moodle's own error messages; logout; the token never reaches the browser |
| `courses.spec.ts` | Dashboard, catalogue, course page; hidden courses never shown; not-enrolled message; Mark as done updates button, progress bar, course index and dashboard |
| `activities.spec.ts` | Activities open in the app; links in Moodle content rewritten; Previous/Next order; URL, assignment and not-yet-supported activities; hidden activities not found |
| `assignment.spec.ts` | Empty answer caught; draft saved and kept; statement required to submit; submitted work read-only and off Up next; file uploads go to Moodle; accessibility of draft and submitted states |
| `course-index.spec.ts` | Sections, completion and current activity; sections open/close; hide/show remembered; hidden index not reachable by keyboard |
| `up-next.spec.ts` | Deadlines grouped and in order; hidden courses left out; links open in the app; finished activities drop off; dashboard still works if the calendar fails |
| `mobile.spec.ts` | Phone-sized screen: the course index drawer; no sideways scrolling |
| `accessibility.spec.ts` | Automated WCAG 2.2 A/AA checks (axe) on every page |

The mock Moodle's data is described at the top of `e2e/mock-moodle.mjs`: log in as `student` / `secret`. When you add a feature that calls a new Moodle web service, add that function to the mock, then a test.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| *Web services must be enabled* / *Invalid login* on a correct password | Turn on web services and mobile web services in Moodle (step 1) |
| *Access control exception* | The function isn't in the service, or the user lacks the capability |
| Images don't load | Check `MOODLE_URL` matches the address in Moodle's `$CFG->wwwroot` exactly |
| *SESSION_SECRET is not set* | Copy `.env.example` to `.env.local` and fill it in, then restart `npm run dev` |
