<?php
// MyLearning Next: seed a local Moodle with demo courses.
//
// Usage (from anywhere):
//   $(brew --prefix php@8.3)/bin/php seed-moodle.php --moodle=/Applications/MAMP/htdocs/moodle --user=admin
//
// Creates 3 categories and 6 courses with original content, turns on completion
// tracking, enrols --user in 4 courses at different progress levels, and adds
// assignment due dates over the next few weeks. Courses that already exist
// (same shortname) are skipped, so it is safe to run again.

// From the command line (below), or from the browser through web-seed.php, which has already
// loaded Moodle, checked that you're a site admin and set $username to you.
if (!defined('MLN_WEB_SEED')) {
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
}
set_config('enablecompletion', 1);

$user = $DB->get_record('user', ['username' => $username, 'deleted' => 0]);
if (!$user) {
    fwrite(STDERR, "No Moodle user called '$username'. Pass --user=yourusername\n");
    exit(1);
}

$gen = new testing_data_generator();

function mln_html(array $blocks): string {
    $out = '';
    foreach ($blocks as $b) {
        if (is_string($b)) {
            $out .= '<p>' . htmlspecialchars($b) . '</p>';
        } else if (isset($b['list'])) {
            $out .= '<ul>' . implode('', array_map(fn($i) => '<li>' . htmlspecialchars($i) . '</li>', $b['list'])) . '</ul>';
        } else if (isset($b['code'])) {
            $out .= '<pre><code>' . htmlspecialchars($b['code']) . '</code></pre>';
        }
    }
    return $out;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
$categories = [
    'webdev'   => 'Web Development',
    'data'     => 'Data & Computing',
    'personal' => 'Personal Development',
];
$catids = [];
foreach ($categories as $key => $name) {
    $idnumber = "mln-$key";
    $existing = $DB->get_record('course_categories', ['idnumber' => $idnumber]);
    $catids[$key] = $existing ? $existing->id : $gen->create_category(['name' => $name, 'idnumber' => $idnumber])->id;
}

// ---------------------------------------------------------------------------
// Courses
// Items: ['page', name, blocks] | ['assign', name, intro, dueInDays] | ['url', name, url]
// 'complete' = how many trackable items (pages and assignments) to mark done for the user.
// ---------------------------------------------------------------------------
$courses = [

    [
        'shortname' => 'AWD101',
        'fullname'  => 'Accessible Web Design',
        'category'  => 'webdev',
        'summary'   => 'Build websites everyone can use. Covers WCAG, semantic HTML, colour contrast, keyboard access and screen readers.',
        'enrol'     => true,
        'complete'  => 5,
        'sections'  => [
            ['Why accessibility matters', 'What accessibility is and the standards behind it.', [
                ['page', 'Accessibility and WCAG', [
                    "Web accessibility means people with disabilities can perceive, understand, navigate and interact with websites. That includes people who are blind or have low vision, deaf people, people with motor impairments, and people with cognitive or learning disabilities. Accessible design helps everyone else too: captions help in noisy places, and clear layouts help people in a hurry.",
                    "The Web Content Accessibility Guidelines (WCAG), published by the W3C, are the international standard. The current version is WCAG 2.2. Its guidelines sit under four principles, often remembered as POUR:",
                    ['list' => [
                        "Perceivable: information can be presented in ways users can perceive, for example text alternatives for images.",
                        "Operable: everything works with a keyboard, and users have enough time to read and act.",
                        "Understandable: content is readable and the interface behaves predictably.",
                        "Robust: content works with current and future assistive technologies.",
                    ]],
                    "Each success criterion has a conformance level: A (minimum), AA (the usual legal and contractual target) and AAA (enhanced). In the UK, public sector websites are expected to meet WCAG 2.2 AA.",
                ]],
                ['url', 'WCAG overview (W3C)', 'https://www.w3.org/WAI/standards-guidelines/wcag/'],
            ]],
            ['Semantic HTML', 'Choosing elements for their meaning.', [
                ['page', 'Use the right element', [
                    "Semantic HTML means choosing elements for their meaning, not their appearance. Browsers expose that meaning to assistive technologies through the accessibility tree, so a real button is announced as a button, can be focused, and works with Enter and Space without extra code.",
                    ['list' => [
                        "Use one h1 per page and don't skip heading levels. Screen reader users often navigate by headings.",
                        "Use landmarks: header, nav, main, aside and footer.",
                        "Use button for actions and a (with an href) for navigation.",
                        "Give every form control a visible label connected with the for and id attributes.",
                        "Use lists for lists, and tables only for tabular data, with th for header cells.",
                    ]],
                    "The first rule of ARIA: if a native HTML element already does what you need, use it rather than adding ARIA roles to a div. No ARIA is better than bad ARIA.",
                ]],
            ]],
            ['Colour and contrast', 'Making text and controls easy to see.', [
                ['page', 'Contrast ratios', [
                    "WCAG AA requires a contrast ratio of at least 4.5:1 between text and its background. Large text, meaning at least 18 point or 14 point bold, needs 3:1. Icons, input borders and focus indicators also need 3:1 against adjacent colours.",
                    "Never use colour as the only way to convey information. A form error shown only in red is missed by many colour-blind users, so add an icon and a text message too. Links inside paragraphs should be distinguishable by more than colour, usually with an underline.",
                    "Check contrast with your browser's developer tools or a dedicated contrast checker, and try viewing your design in greyscale.",
                ]],
            ]],
            ['Keyboard and screen readers', 'Access without a mouse or a screen.', [
                ['page', 'Keyboard access and focus', [
                    "Many people navigate with a keyboard alone. Every interactive element must be reachable with Tab, usable with Enter or Space, and show a clearly visible focus indicator. Never remove focus outlines without replacing them.",
                    ['list' => [
                        "Keep the DOM order the same as the visual order so focus moves logically.",
                        "Add a skip link as the first focusable element so users can jump to the main content.",
                        "In dialogs, move focus in when they open, keep it inside while open, and return it to the trigger when they close.",
                        "Avoid positive tabindex values.",
                    ]],
                ]],
                ['page', 'Text alternatives', [
                    "Every informative image needs alt text that conveys its purpose in context, not a description of every pixel. Decorative images should have an empty alt attribute so screen readers skip them. Avoid images of text; use real text styled with CSS.",
                    "Test with a real screen reader: VoiceOver is built into macOS and iOS, NVDA is free on Windows, and TalkBack comes with Android.",
                ]],
                ['assign', 'Assignment: Accessibility audit', "Choose a public web page and audit it against five WCAG 2.2 AA success criteria of your choice. For each one, note whether it passes, your evidence, and a suggested fix. Submit your findings as online text.", 4],
            ]],
        ],
    ],

    [
        'shortname' => 'JS101',
        'fullname'  => 'JavaScript Fundamentals',
        'category'  => 'webdev',
        'summary'   => 'Learn modern JavaScript from the ground up: values, functions, arrays and objects, the DOM, asynchronous code and modules.',
        'enrol'     => true,
        'complete'  => 1,
        'sections'  => [
            ['Values and variables', 'Types, declarations and equality.', [
                ['page', 'Types and variables', [
                    "JavaScript has seven primitive types (string, number, bigint, boolean, undefined, null and symbol) plus objects, which include arrays and functions.",
                    "Declare variables with const by default, and let when you need to reassign. Avoid var: it is function-scoped rather than block-scoped, which leads to surprising bugs.",
                    ['code' => "const name = 'Ada';\nlet count = 0;\ncount += 1;\ntypeof name; // 'string'\ntypeof null; // 'object' (a historical quirk)"],
                    "Use strict equality (===) rather than ==, which converts types before comparing: 0 == '' is true, but 0 === '' is false.",
                ]],
            ]],
            ['Functions', 'Declarations, arrow functions and closures.', [
                ['page', 'Functions and closures', [
                    "Functions can be declared, assigned to variables, passed as arguments and returned from other functions.",
                    ['code' => "function add(a, b) {\n  return a + b;\n}\nconst double = (n) => n * 2;\n[1, 2, 3].map(double); // [2, 4, 6]"],
                    "A closure is a function that remembers the variables from the scope where it was created, even after that scope has finished running. Closures are a simple way to keep private state:",
                    ['code' => "function makeCounter() {\n  let count = 0;\n  return () => ++count;\n}\nconst next = makeCounter();\nnext(); // 1\nnext(); // 2"],
                    "Arrow functions don't have their own this, which makes them convenient for callbacks but unsuitable for object methods that rely on this.",
                ]],
            ]],
            ['Arrays and objects', 'Transforming and combining data.', [
                ['page', 'Array methods, destructuring and spread', [
                    "map transforms each item, filter keeps the items that pass a test, and reduce combines items into a single value. None of them change the original array.",
                    ['code' => "const prices = [12, 5, 30];\nconst withVat = prices.map((p) => p * 1.2);\nconst cheap = prices.filter((p) => p < 20);\nconst total = prices.reduce((sum, p) => sum + p, 0); // 47"],
                    "Destructuring and spread make working with objects concise:",
                    ['code' => "const user = { name: 'Sam', role: 'student' };\nconst { name } = user;\nconst updated = { ...user, role: 'tutor' };"],
                ]],
                ['assign', 'Exercise: Array methods', "Given an array of course objects with title and progress fields, write functions that return the titles of completed courses, the average progress, and the courses sorted by progress. Paste your code as online text.", 6],
            ]],
            ['The DOM and events', 'Working with the page.', [
                ['page', 'Selecting elements and handling events', [
                    "The Document Object Model (DOM) is the browser's live representation of the page. Select elements with document.querySelector and querySelectorAll, and change them through properties such as textContent and classList.",
                    ['code' => "const button = document.querySelector('#save');\nbutton.addEventListener('click', () => {\n  button.textContent = 'Saved';\n});"],
                    "Event delegation attaches one listener to a parent instead of one per child. It works because most events bubble up the tree, and it also handles elements added later. Use event.target.closest() to find which child was clicked.",
                    "Prefer textContent over innerHTML when inserting user-provided text, to avoid cross-site scripting (XSS).",
                ]],
            ]],
            ['Asynchronous JavaScript', 'Promises, async/await and fetch.', [
                ['page', 'Promises and fetch', [
                    "JavaScript runs on a single thread and uses an event loop to handle work that takes time, such as network requests. A Promise represents a value that will be available later, and async/await lets you write that code in a readable, top-to-bottom style.",
                    ['code' => "async function loadCourses() {\n  try {\n    const res = await fetch('/api/courses');\n    if (!res.ok) throw new Error('HTTP ' + res.status);\n    return await res.json();\n  } catch (err) {\n    console.error(err);\n    return [];\n  }\n}"],
                    "fetch only rejects on a network failure. An HTTP error such as 404 still resolves, so always check res.ok. Use Promise.all to run independent requests in parallel.",
                ]],
                ['assign', 'Exercise: Fetch and display', "Build a small page that fetches JSON from a public API, shows a loading state, renders the results as a list, and shows a friendly message if the request fails. Submit a link to your code.", 13],
            ]],
            ['Modules and tooling', 'Organising code and using packages.', [
                ['page', 'ES modules and npm', [
                    "ES modules split code into files. Use export to share values and import to use them. Named exports are explicit; a module can also have one default export.",
                    ['code' => "// math.js\nexport const add = (a, b) => a + b;\n\n// app.js\nimport { add } from './math.js';"],
                    "npm installs the packages listed in package.json. Build tools and frameworks such as Vite and Next.js resolve imports, transform modern syntax and optimise code for the browser.",
                ]],
                ['url', 'MDN JavaScript Guide', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide'],
            ]],
        ],
    ],

    [
        'shortname' => 'PY101',
        'fullname'  => 'Python Basics',
        'category'  => 'data',
        'summary'   => 'A gentle introduction to programming with Python: variables, decisions, loops, functions and lists.',
        'enrol'     => false,
        'complete'  => 0,
        'sections'  => [
            ['Getting started', 'Running Python and your first program.', [
                ['page', 'Your first Python program', [
                    "Python is a general-purpose language known for readable code. Install it from python.org or with a package manager, then run python3 in a terminal to open the interactive shell.",
                    ['code' => "name = \"Ada\"\nage = 36\nprint(f\"{name} is {age} years old\")"],
                    "Python uses indentation to define blocks of code, so consistent spacing (four spaces is the convention) is part of the syntax, not just style.",
                ]],
            ]],
            ['Decisions and loops', 'if, for and while.', [
                ['page', 'Making decisions and repeating', [
                    "Use if, elif and else to choose between paths. Loop over a sequence with for, and use while to repeat until a condition becomes false.",
                    ['code' => "for n in range(1, 6):\n    if n % 2 == 0:\n        print(n, \"is even\")\n    else:\n        print(n, \"is odd\")"],
                    "range(1, 6) produces the numbers 1 to 5: the end value is excluded.",
                ]],
            ]],
            ['Functions and lists', 'Reusable code and collections.', [
                ['page', 'Functions, lists and comprehensions', [
                    "Define functions with def. Lists hold ordered collections that can be changed, and a list comprehension builds a new list in one readable line.",
                    ['code' => "def average(scores):\n    return sum(scores) / len(scores)\n\nscores = [72, 85, 90]\npassed = [s for s in scores if s >= 80]\nprint(average(scores), passed)"],
                ]],
                ['assign', 'Exercise: Grade calculator', "Write a function that takes a list of scores and returns the average, the highest score and a letter grade. Paste your code as online text.", 10],
                ['url', 'The official Python tutorial', 'https://docs.python.org/3/tutorial/'],
            ]],
        ],
    ],

    [
        'shortname' => 'DATA101',
        'fullname'  => 'Introduction to Data Literacy',
        'category'  => 'data',
        'summary'   => 'Read charts critically, choose the right average, and spot misleading statistics.',
        'enrol'     => false,
        'complete'  => 0,
        'sections'  => [
            ['Reading charts', 'What to check before you interpret.', [
                ['page', 'How to read a chart', [
                    "Before interpreting any chart, read its title, axis labels, units and source. Ask what is being measured, over what period, and who collected the data.",
                    "Bar charts compare categories, line charts show change over time, and scatter plots show the relationship between two numeric variables. Pie charts only work for a few parts of a single whole.",
                ]],
            ]],
            ['Averages', 'Mean, median and mode.', [
                ['page', 'Choosing the right average', [
                    "The mean adds all the values and divides by how many there are. The median is the middle value when they are sorted. The mode is the most common value.",
                    "When data is skewed, the mean and median can differ a lot. Household income is the classic example: a small number of very high earners pull the mean up, so the median gives a better picture of a typical household.",
                    "Whenever you see an average, ask which one is being reported, and why.",
                ]],
            ]],
            ['Correlation and causation', 'Moving together is not the same as causing.', [
                ['page', 'Correlation is not causation', [
                    "Two variables are correlated when they tend to move together. That alone doesn't show that one causes the other. Ice cream sales and drowning incidents both rise in summer because of a third factor: warm weather.",
                    "Randomised controlled trials are the strongest way to test causation, because random assignment balances other factors between the groups being compared.",
                ]],
            ]],
            ['Spotting misleading graphs', 'Common tricks and how to see through them.', [
                ['page', 'Common ways graphs mislead', [
                    ['list' => [
                        "A bar chart whose y-axis doesn't start at zero can exaggerate small differences.",
                        "A cherry-picked time range can hide the overall trend.",
                        "Two y-axes on one chart can suggest a relationship that isn't there.",
                        "3D effects distort the relative size of slices and bars.",
                        "Percentage changes on small numbers look dramatic: going from 2 cases to 4 is a 100% increase.",
                    ]],
                ]],
                ['assign', 'Assignment: Critique a chart', "Find a chart in the news or on social media. Describe what it claims, assess whether the chart supports that claim, and suggest how it could be presented more honestly.", 15],
            ]],
        ],
    ],

    [
        'shortname' => 'STUDY101',
        'fullname'  => 'Study Skills & Time Management',
        'category'  => 'personal',
        'summary'   => 'Practical techniques to plan your time, remember more and study with focus.',
        'enrol'     => true,
        'complete'  => 1,
        'sections'  => [
            ['Planning your week', 'Turning deadlines into a plan.', [
                ['page', 'The weekly review', [
                    "Start each week with a 15-minute review. List your deadlines, estimate how long each task will take, and block time for them in your calendar. Treat study blocks like appointments.",
                    "Break large assignments into small, concrete next actions. 'Write essay' is hard to start; 'Write three bullet points for the introduction' is not.",
                ]],
                ['assign', 'Task: Make a weekly plan', "Create a plan for the coming week that includes all your deadlines and at least three study blocks. Submit it as online text.", 2],
            ]],
            ['Learning that sticks', 'Active recall and spaced repetition.', [
                ['page', 'Active recall and spaced repetition', [
                    "Active recall means testing yourself instead of rereading. Close your notes and try to explain the topic or answer practice questions: the effort of retrieving information strengthens memory.",
                    "Spaced repetition means reviewing material at increasing intervals, for example after one day, three days, a week and a month, rather than cramming the night before. Flashcard apps can schedule this for you.",
                ]],
            ]],
            ['Focus and breaks', 'Working in focused blocks.', [
                ['page', 'The Pomodoro Technique', [
                    "The Pomodoro Technique uses 25 minutes of focused work followed by a 5-minute break. After four rounds, take a longer break of 15 to 30 minutes.",
                    "Reduce distractions before you start: put your phone in another room, close unrelated tabs, and decide in advance what you'll work on.",
                ]],
            ]],
            ['Taking good notes', 'Notes you can learn from.', [
                ['page', 'The Cornell method', [
                    "The Cornell method divides a page into three areas: a wide column for notes during the lesson, a narrow cue column for questions and keywords added afterwards, and a short summary at the bottom.",
                    "Write notes in your own words and review them within 24 hours. The cue column then becomes a ready-made set of self-test questions.",
                ]],
            ]],
        ],
    ],

    [
        'shortname' => 'HORSE101',
        'fullname'  => 'Horse Care Essentials',
        'category'  => 'personal',
        'summary'   => 'Everyday care for horses and ponies: handling, health checks, feeding, turnout and foot care. Original course content, with links to British Horse Society advice for further reading.',
        'enrol'     => true,
        'complete'  => 4,
        'sections'  => [
            ['Handling and grooming', 'Working safely around horses.', [
                ['page', 'Safe handling', [
                    "Approach a horse calmly towards its shoulder, speaking so it knows you're there, and avoid approaching directly from behind. Wear sturdy boots and gloves when leading.",
                    "When tying up, use a quick-release knot and tie to a loop of breakable string rather than directly to a fixed ring, so the horse can break free if it panics.",
                ]],
                ['page', 'Grooming kit and routine', [
                    ['list' => [
                        "Rubber curry comb: used in circles to loosen dirt and dead hair.",
                        "Dandy brush: stiff bristles for removing dried mud; use it gently, and not on sensitive areas.",
                        "Body brush: soft bristles for removing grease and dust from the coat, mane and tail.",
                        "Metal curry comb: used to clean the body brush, never on the horse.",
                        "Hoof pick: used from heel to toe, working in the grooves either side of the frog.",
                    ]],
                    "Grooming is also a daily health check: look and feel for cuts, heat, swelling and lumps as you go.",
                ]],
            ]],
            ['Health checks', 'Knowing what normal looks like.', [
                ['page', 'Signs of good health', [
                    "A healthy horse is alert and interested in its surroundings, with bright eyes, a glossy coat and a good appetite. It stands evenly on all four feet and passes regular, well-formed droppings.",
                    "Typical resting values for an adult horse are a temperature of 37.5–38.5°C, a pulse of 28–44 beats per minute and 8–16 breaths per minute. Learn your own horse's normal values while it is well, so you can spot changes.",
                    "Gums should be moist and salmon pink. When pressed, the colour should return within about two seconds.",
                ]],
                ['page', 'When to call the vet', [
                    "Call your vet promptly for signs of colic, such as pawing, repeatedly lying down and getting up, rolling, looking round at the flank, sweating, or no droppings. Colic can become life-threatening quickly.",
                    "Also call for sudden lameness, a wound near a joint or one that won't stop bleeding, a raised temperature, or a horse that refuses food.",
                ]],
                ['url', 'Further reading: BHS health, care and management', 'https://www.bhs.org.uk/horse-care-and-welfare/health-care-management/'],
            ]],
            ['Feeding and watering', 'The rules of good feeding.', [
                ['page', 'The rules of feeding', [
                    ['list' => [
                        "Provide constant access to clean, fresh water.",
                        "Base the diet on forage such as grass, hay or haylage: usually at least 1.5% of bodyweight per day in dry matter.",
                        "Feed little and often. Horses have small stomachs and evolved to graze for most of the day.",
                        "Make any changes to the diet gradually, over at least one to two weeks.",
                        "Feed according to bodyweight, workload, age and temperament.",
                        "Keep to a routine, and don't work a horse hard straight after a large feed.",
                        "Use good-quality feed, stored dry and free from mould.",
                    ]],
                ]],
            ]],
            ['Turnout and grazing', 'Keeping horses safe at grass.', [
                ['page', 'Safe turnout', [
                    "Turnout lets horses move, graze and socialise, which supports both physical and mental health. Check horses at grass at least once a day, and ideally twice.",
                    ['list' => [
                        "Use safe, well-maintained fencing and avoid barbed wire.",
                        "Check fields regularly for poisonous plants. Ragwort should be dug up and removed, as it stays toxic when dried.",
                        "Watch for sycamore seeds and seedlings, which are linked to atypical myopathy, an often fatal muscle disease.",
                        "Poo-pick regularly to reduce worm burdens, and rest and rotate paddocks.",
                        "Provide shelter from wind, rain and sun, either natural or a field shelter.",
                    ]],
                ]],
                ['assign', 'Task: Field safety check', "Carry out a safety check of a field or paddock. Record the fencing, gates, water supply, shelter, any poisonous plants and anything that needs fixing, and submit your checklist.", 9],
            ]],
            ['Feet and shoeing', 'Everyday foot care and warning signs.', [
                ['page', 'Foot care', [
                    "Pick out feet daily, and before and after exercise, checking for stones, heat and any unusual smell.",
                    "Most horses need a farrier visit every five to eight weeks, whether shod or barefoot. Signs that shoes need attention include a loose or twisted shoe, risen clenches, a worn shoe or an overgrown foot.",
                    "Thrush is a bacterial infection of the frog that causes a black, foul-smelling discharge. Prevent it with clean, dry bedding and regular picking out.",
                    "Laminitis is an emergency. Signs include reluctance to move, standing with the weight rocked back onto the heels, heat in the feet and a strong digital pulse. Call your vet straight away.",
                ]],
            ]],
        ],
    ],
];

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
foreach ($courses as $c) {
    if ($DB->record_exists('course', ['shortname' => $c['shortname']])) {
        echo "Skipping {$c['shortname']} (already exists)\n";
        continue;
    }

    $course = $gen->create_course([
        'fullname'         => $c['fullname'],
        'shortname'        => $c['shortname'],
        'category'         => $catids[$c['category']],
        'summary'          => '<p>' . htmlspecialchars($c['summary']) . '</p>',
        'summaryformat'    => FORMAT_HTML,
        'format'           => 'topics',
        'numsections'      => count($c['sections']),
        'enablecompletion' => 1,
        'startdate'        => time() - 14 * DAYSECS,
    ]);

    $trackable = [];
    foreach ($c['sections'] as $i => [$name, $summary, $items]) {
        $sectionnum = $i + 1;
        $section = $DB->get_record('course_sections', ['course' => $course->id, 'section' => $sectionnum], '*', MUST_EXIST);
        $section->name = $name;
        $section->summary = '<p>' . htmlspecialchars($summary) . '</p>';
        $section->summaryformat = FORMAT_HTML;
        $section->timemodified = time();
        $DB->update_record('course_sections', $section);

        foreach ($items as $item) {
            $base = ['course' => $course->id, 'section' => $sectionnum, 'name' => $item[1]];
            switch ($item[0]) {
                case 'page':
                    $mod = $gen->create_module('page', $base + [
                        'intro'         => '',
                        'content'       => mln_html($item[2]),
                        'contentformat' => FORMAT_HTML,
                        'completion'    => COMPLETION_TRACKING_MANUAL,
                    ]);
                    $trackable[] = $mod->cmid;
                    break;
                case 'assign':
                    $mod = $gen->create_module('assign', $base + [
                        'intro'                               => '<p>' . htmlspecialchars($item[2]) . '</p>',
                        'introformat'                         => FORMAT_HTML,
                        'duedate'                             => time() + $item[3] * DAYSECS,
                        'allowsubmissionsfromdate'            => 0,
                        'assignsubmission_onlinetext_enabled' => 1,
                        'completion'                          => COMPLETION_TRACKING_MANUAL,
                    ]);
                    $trackable[] = $mod->cmid;
                    break;
                case 'url':
                    $gen->create_module('url', $base + [
                        'intro'       => '',
                        'externalurl' => $item[2],
                        'completion'  => COMPLETION_TRACKING_NONE,
                    ]);
                    break;
            }
        }
    }
    rebuild_course_cache($course->id, true);
    $course = get_course($course->id);

    $status = 'not enrolled (catalogue only)';
    if ($c['enrol']) {
        $gen->enrol_user($user->id, $course->id, 'student');
        $completion = new completion_info($course);
        foreach (array_slice($trackable, 0, $c['complete']) as $cmid) {
            $cm = get_coursemodule_from_id('', $cmid, $course->id, false, MUST_EXIST);
            $completion->update_state($cm, COMPLETION_COMPLETE, $user->id);
        }
        $pct = count($trackable) ? round(100 * $c['complete'] / count($trackable)) : 0;
        $status = "enrolled {$user->username}, {$c['complete']}/" . count($trackable) . " done ({$pct}%)";
    }
    echo "Created {$c['shortname']} {$c['fullname']}: $status\n";
}

echo "Done. Completion tracking is on site-wide.\n";
