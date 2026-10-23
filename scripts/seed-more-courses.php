<?php
// MyLearning Next: add ~45 more demo courses to a local Moodle, for trying out course search.
//
// Usage (same --moodle and --user as seed-moodle.php):
//   $(brew --prefix php@8.3)/bin/php scripts/seed-more-courses.php --moodle=/path/to/moodle --user=admin
//
// Creates courses across 7 categories (4 new ones), each with three short topics and a page
// per topic. Most are catalogue-only; --user is enrolled in five, at different progress levels.
// Courses that already exist (same shortname) are skipped, so it is safe to run again.
// The content is short placeholder text: enough for titles, summaries and topics to search.

if (php_sapi_name() !== 'cli') {
    exit("Run this from the command line.\n");
}

$opts = getopt('', ['moodle::', 'user::']);
$moodle = rtrim($opts['moodle'] ?? '/Applications/MAMP/htdocs/moodle', '/');
$username = $opts['user'] ?? 'admin';

if (!is_file("$moodle/config.php")) {
    fwrite(STDERR, "config.php not found in $moodle. Pass --moodle=/path/to/moodle\n");
    exit(1);
}

define('CLI_SCRIPT', true);
require "$moodle/config.php";
require_once($CFG->libdir . '/completionlib.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->libdir . '/testing/generator/lib.php');

\core\session\manager::set_user(get_admin());
set_config('enablecompletion', 1);

$user = $DB->get_record('user', ['username' => $username, 'deleted' => 0]);
if (!$user) {
    fwrite(STDERR, "No Moodle user called '$username'. Pass --user=yourusername\n");
    exit(1);
}

$gen = new testing_data_generator();

// Categories: the first three are the ones seed-moodle.php made (matched by idnumber).
$categories = [
    'webdev'    => 'Web Development',
    'data'      => 'Data & Computing',
    'personal'  => 'Personal Development',
    'design'    => 'Design & UX',
    'business'  => 'Business & Careers',
    'languages' => 'Languages',
    'animals'   => 'Animal Care',
];
$catids = [];
foreach ($categories as $key => $name) {
    $idnumber = "mln-$key";
    $existing = $DB->get_record('course_categories', ['idnumber' => $idnumber]);
    $catids[$key] = $existing ? $existing->id : $gen->create_category(['name' => $name, 'idnumber' => $idnumber])->id;
}

// [shortname, full name, category, summary, [three topics], how many topics the user has done (null = not enrolled)]
$courses = [
    // Web Development
    ['REACT101', 'React Fundamentals', 'webdev', 'Components, props, state and hooks: build interactive user interfaces with React.', ['Components and JSX', 'State and hooks', 'Lists, keys and forms'], 2],
    ['NEXT201', 'Next.js with the App Router', 'webdev', 'Server components, routing, data fetching and caching in modern Next.js.', ['Routes and layouts', 'Server and client components', 'Caching and revalidation'], null],
    ['TS101', 'TypeScript for JavaScript Developers', 'webdev', 'Add types to your JavaScript: interfaces, generics and safer refactoring.', ['Basic types', 'Interfaces and unions', 'Generics'], null],
    ['CSS201', 'CSS Layout with Grid and Flexbox', 'webdev', 'Lay out responsive pages with CSS Grid, Flexbox and container queries.', ['Flexbox', 'CSS Grid', 'Responsive layouts'], null],
    ['PERF101', 'Web Performance Basics', 'webdev', 'Measure and improve page speed: Core Web Vitals, images and caching.', ['Core Web Vitals', 'Images and fonts', 'Caching'], null],
    ['TEST201', 'Testing Web Apps with Playwright', 'webdev', 'End-to-end and accessibility testing for web applications with Playwright.', ['Your first test', 'Locators and assertions', 'Testing in CI'], null],
    ['NODE101', 'Building APIs with Node.js', 'webdev', 'Create REST APIs with Node.js: routing, validation and error handling.', ['HTTP and REST', 'Routing and validation', 'Errors and logging'], null],
    ['PWA201', 'Progressive Web Apps', 'webdev', 'Make web apps installable and usable offline with service workers.', ['Web app manifest', 'Service workers', 'Offline strategies'], null],

    // Data & Computing
    ['PY101', 'Python for Beginners', 'data', 'Learn to program in Python: variables, loops, functions and files.', ['Variables and types', 'Loops and functions', 'Working with files'], 1],
    ['PANDAS201', 'Data Analysis with pandas', 'data', 'Load, clean, group and summarise data in Python with pandas.', ['DataFrames', 'Cleaning data', 'Grouping and summarising'], null],
    ['SQL101', 'SQL Essentials', 'data', 'Query relational databases: SELECT, JOIN, GROUP BY and indexes.', ['Selecting rows', 'Joins', 'Aggregates and indexes'], null],
    ['ML101', 'Introduction to Machine Learning', 'data', 'Core ideas of machine learning: training, testing, overfitting and evaluation.', ['What is a model?', 'Training and testing', 'Evaluating models'], null],
    ['NLP201', 'Natural Language Processing Basics', 'data', 'Tokens, embeddings and text classification: how computers work with language.', ['Tokenisation', 'Embeddings', 'Text classification'], null],
    ['DATAVIZ101', 'Data Visualisation Principles', 'data', 'Choose the right chart and design clear, honest, accessible visualisations.', ['Choosing a chart', 'Colour and labels', 'Accessible charts'], null],
    ['GIT101', 'Git and Version Control', 'data', 'Track changes, branch, merge and collaborate with Git and GitHub.', ['Commits', 'Branches and merging', 'Pull requests'], null],
    ['CLOUD101', 'Cloud Computing Fundamentals', 'data', 'Servers, storage, containers and serverless: the basics of cloud platforms.', ['What the cloud is', 'Containers', 'Serverless'], null],

    // Design & UX
    ['UXR101', 'UX Research Methods', 'design', 'Interviews, usability testing and surveys: learn what users really need.', ['Planning research', 'Usability testing', 'Sharing findings'], 1],
    ['TYPE101', 'Typography for Screens', 'design', 'Choose and pair typefaces, set line length and build a readable type scale.', ['Choosing typefaces', 'Type scales', 'Readability'], null],
    ['DS201', 'Design Systems in Practice', 'design', 'Tokens, components and documentation: build and run a design system.', ['Design tokens', 'Component libraries', 'Governance'], null],
    ['COLOUR101', 'Colour and Contrast', 'design', 'Build colour palettes that work for everyone and meet WCAG contrast.', ['Colour theory', 'Contrast ratios', 'Dark mode'], null],
    ['PROTO101', 'Prototyping with Figma', 'design', 'Wireframes to interactive prototypes: quick ways to test design ideas.', ['Wireframes', 'Components and variants', 'Interactive prototypes'], null],
    ['INCL201', 'Inclusive Design', 'design', 'Design for disability, age, language and situation from the start.', ['Who we exclude', 'Inclusive patterns', 'Testing with people'], null],

    // Business & Careers
    ['PM101', 'Project Management Basics', 'business', 'Plan, schedule and deliver projects: scope, risks and stakeholders.', ['Scope and planning', 'Risks', 'Stakeholders'], null],
    ['AGILE101', 'Agile and Scrum', 'business', 'Sprints, stand-ups, backlogs and retrospectives in agile teams.', ['Agile values', 'Scrum roles and events', 'Backlogs and estimates'], null],
    ['CV101', 'Writing a Strong CV', 'business', 'Structure your CV, describe impact and tailor it to each job.', ['Structure', 'Showing impact', 'Tailoring'], null],
    ['INT101', 'Interview Skills', 'business', 'Prepare for interviews: the STAR method, technical interviews and questions to ask.', ['Preparing', 'The STAR method', 'Technical interviews'], null],
    ['PROD101', 'Introduction to Product Management', 'business', 'Discovery, prioritisation and roadmaps: what product managers do.', ['Discovery', 'Prioritisation', 'Roadmaps'], null],
    ['FREE101', 'Freelancing Essentials', 'business', 'Find clients, price your work, write contracts and manage invoices.', ['Finding clients', 'Pricing', 'Contracts and invoices'], null],
    ['PRES101', 'Presenting with Confidence', 'business', 'Plan a talk, design clear slides and handle questions with confidence.', ['Planning a talk', 'Slides', 'Questions and nerves'], null],

    // Languages
    ['JA101', 'Japanese for Beginners', 'languages', 'Hiragana, katakana and everyday phrases for your first steps in Japanese.', ['Hiragana', 'Katakana', 'Everyday phrases'], 0],
    ['ES101', 'Everyday Spanish', 'languages', 'Greetings, food, travel and directions: practical Spanish for daily life.', ['Greetings', 'Food and shopping', 'Travel and directions'], null],
    ['FR201', 'French Conversation', 'languages', 'Build confidence speaking French about work, hobbies and opinions.', ['Talking about work', 'Hobbies', 'Giving opinions'], null],
    ['BE201', 'Business English', 'languages', 'Emails, meetings and negotiations in clear, professional English.', ['Emails', 'Meetings', 'Negotiating'], null],
    ['BSL101', 'British Sign Language Introduction', 'languages', 'Fingerspelling, greetings and everyday signs in British Sign Language.', ['Fingerspelling', 'Greetings', 'Everyday signs'], null],

    // Animal Care
    ['DOG101', 'Dog Behaviour and Training', 'animals', 'Understand dog body language and train with positive reinforcement.', ['Body language', 'Positive reinforcement', 'Common problems'], 3],
    ['PETAID101', 'First Aid for Pets', 'animals', 'What to do in an emergency: wounds, choking, heatstroke and poisoning.', ['Checking vital signs', 'Wounds and bleeding', 'Heatstroke and poisoning'], null],
    ['STABLE201', 'Stable Management', 'animals', 'Mucking out, bedding, grooming and daily routines for stabled horses.', ['Daily routine', 'Bedding', 'Grooming'], null],
    ['EQNUT201', 'Equine Nutrition', 'animals', 'Forage, feed and water: plan a balanced diet for horses and ponies.', ['Forage first', 'Concentrates', 'Water and supplements'], null],
    ['RESCUE101', 'Volunteering at an Animal Rescue', 'animals', 'Kennel care, socialising rescue animals and helping with adoptions.', ['Kennel care', 'Socialising', 'Adoption'], null],

    // Personal Development
    ['MIND101', 'Mindfulness at Work', 'personal', 'Simple practices to focus better and manage stress during the working day.', ['Breathing', 'Focus', 'Handling stress'], null],
    ['TIME101', 'Time Management', 'personal', 'Prioritise, plan your week and protect time for deep work.', ['Priorities', 'Planning your week', 'Deep work'], null],
    ['LEARN101', 'Learning How to Learn', 'personal', 'Spaced repetition, retrieval practice and other ways to learn faster.', ['How memory works', 'Spaced repetition', 'Retrieval practice'], null],
    ['FIN101', 'Personal Finance Basics', 'personal', 'Budgeting, saving and understanding pensions and interest.', ['Budgeting', 'Saving', 'Pensions and interest'], null],
    ['SPEAK201', 'Public Speaking', 'personal', 'Storytelling, voice and body language for talks of any size.', ['Storytelling', 'Voice', 'Body language'], null],
    ['DESK101', 'Healthy Habits for Desk Workers', 'personal', 'Posture, movement breaks and screen habits for long days at a desk.', ['Posture', 'Movement breaks', 'Screen habits'], null],
];

$created = 0;
foreach ($courses as [$shortname, $fullname, $cat, $summary, $topics, $done]) {
    if ($DB->record_exists('course', ['shortname' => $shortname])) {
        echo "Skipping $shortname (already exists)\n";
        continue;
    }

    $course = $gen->create_course([
        'fullname'         => $fullname,
        'shortname'        => $shortname,
        'category'         => $catids[$cat],
        'summary'          => '<p>' . htmlspecialchars($summary) . '</p>',
        'summaryformat'    => FORMAT_HTML,
        'format'           => 'topics',
        'numsections'      => count($topics),
        'enablecompletion' => 1,
        'startdate'        => time() - 7 * DAYSECS,
    ]);

    $trackable = [];
    foreach ($topics as $i => $topic) {
        $sectionnum = $i + 1;
        $section = $DB->get_record('course_sections', ['course' => $course->id, 'section' => $sectionnum], '*', MUST_EXIST);
        $section->name = $topic;
        $section->summary = '<p>' . htmlspecialchars("Topic " . $sectionnum . " of " . $fullname . ".") . '</p>';
        $section->summaryformat = FORMAT_HTML;
        $section->timemodified = time();
        $DB->update_record('course_sections', $section);

        $content = '<p>' . htmlspecialchars("This page introduces $topic, part of $fullname.") . '</p>'
            . '<p>' . htmlspecialchars($summary) . '</p>'
            . '<p>' . htmlspecialchars('Demo content: replace it with your own material.') . '</p>';
        $mod = $gen->create_module('page', [
            'course'        => $course->id,
            'section'       => $sectionnum,
            'name'          => $topic,
            'intro'         => '',
            'content'       => $content,
            'contentformat' => FORMAT_HTML,
            'completion'    => COMPLETION_TRACKING_MANUAL,
        ]);
        $trackable[] = $mod->cmid;
    }
    rebuild_course_cache($course->id, true);
    $course = get_course($course->id);

    $status = 'catalogue only';
    if ($done !== null) {
        $gen->enrol_user($user->id, $course->id, 'student');
        $completion = new completion_info($course);
        foreach (array_slice($trackable, 0, $done) as $cmid) {
            $cm = get_coursemodule_from_id('', $cmid, $course->id, false, MUST_EXIST);
            $completion->update_state($cm, COMPLETION_COMPLETE, $user->id);
        }
        $status = "enrolled {$user->username}, $done/" . count($trackable) . ' done';
    }
    $created++;
    echo "Created $shortname $fullname ($categories[$cat]): $status\n";
}

echo "Done. Created $created courses.\n";
