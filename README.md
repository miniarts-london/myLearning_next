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

## How the code is organised

```
src/
├── proxy.ts                         Redirects to /login when there's no session cookie (a quick check only)
├── lib/
│   ├── moodle.ts                    Typed Moodle client: call(), getToken(), and one function per web service
│   ├── types.ts                     Types for the Moodle responses the app uses
│   ├── session.ts                   Encrypted session cookie (jose, A256GCM): create, read, delete
│   ├── dal.ts                       verifySession(): the real auth check, used by every page and action
│   └── files.ts                     fileUrl(): points Moodle file links at /api/file
├── components/                      CourseCard, ProgressBar, NavLinks, SafeHtml (sanitised Moodle HTML), Loading
└── app/
    ├── login/                       Log in page, form (useActionState) and the login/logout Server Actions
    ├── (app)/layout.tsx             Header and navigation for logged-in pages
    ├── (app)/dashboard/             My courses
    ├── (app)/catalogue/             Courses by category
    ├── (app)/courses/[id]/          Course page, and the Mark as done Server Action
    └── api/file/route.ts            Streams Moodle files with the token added on the server
```

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

## Troubleshooting

| Problem | Fix |
| --- | --- |
| *Web services must be enabled* / *Invalid login* on a correct password | Turn on web services and mobile web services in Moodle (step 1) |
| *Access control exception* | The function isn't in the service, or the user lacks the capability |
| Images don't load | Check `MOODLE_URL` matches the address in Moodle's `$CFG->wwwroot` exactly |
| *SESSION_SECRET is not set* | Copy `.env.example` to `.env.local` and fill it in, then restart `npm run dev` |
