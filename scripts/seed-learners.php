<?php
// MyLearning Next: add a teacher and a class of learners to a few demo courses, for the
// teachers' and admins' learner list (/courses/[id]/learners).
//
// Usage:
//   $(brew --prefix php@8.3)/bin/php scripts/seed-learners.php --moodle=/Applications/MAMP/htdocs/moodle
//
// Creates (if they don't exist yet):
//   - "teacher" (Tess Teacher), enrolled as a teacher in the courses below
//   - 15 learners, learner01 … learner15, enrolled as students, each with some activities done
//     and a "last visit" between today and a few weeks ago (two have never visited)
// Courses: Accessible Web Design (AWD101), JavaScript (JS101) and React Fundamentals (REACT101),
// whichever exist. Safe to run again: existing users and enrolments are left as they are.
//
// These are test accounts for your local Moodle only. Their passwords are below.

// From the command line (below), or from the browser through web-seed.php, which has already
// loaded Moodle, checked that you're a site admin and set $username to you.
if (!defined('MLN_WEB_SEED')) {
    if (php_sapi_name() !== 'cli') {
        exit("Run this from the command line.\n");
    }

    $opts = getopt('', ['moodle::']);
    $moodle = rtrim($opts['moodle'] ?? '/Applications/MAMP/htdocs/moodle', '/');
    if (!is_file("$moodle/config.php")) {
        fwrite(STDERR, "config.php not found in $moodle. Pass --moodle=/path/to/moodle\n");
        exit(1);
    }

    define('CLI_SCRIPT', true);
    require "$moodle/config.php";
    require_once($CFG->libdir . '/completionlib.php');
    require_once($CFG->libdir . '/testing/generator/lib.php');

    \core\session\manager::set_user(get_admin());
}
$gen = new testing_data_generator();

const TEACHER_PASSWORD = 'Teacher-2026!';
const LEARNER_PASSWORD = 'Learner-2026!';

$learnerNames = [
    ['Priya', 'Shah'], ['Tom', 'Okafor'], ['Lena', 'Fischer'], ['Ben', 'Carter'], ['Aiko', 'Tanaka'],
    ['Omar', 'Haddad'], ['Grace', 'Evans'], ['Mateo', 'Silva'], ['Chloe', 'Martin'], ['Kwame', 'Mensah'],
    ['Sofia', 'Rossi'], ['Jack', 'Murphy'], ['Hana', 'Kim'], ['Leo', 'Novak'], ['Amara', 'Diallo'],
];

function mln_user(testing_data_generator $gen, string $username, string $first, string $last, string $password): stdClass {
    global $DB;
    $existing = $DB->get_record('user', ['username' => $username, 'deleted' => 0]);
    if ($existing) {
        return $existing;
    }
    return $gen->create_user([
        'username'  => $username,
        'password'  => $password,
        'firstname' => $first,
        'lastname'  => $last,
        'email'     => "$username@example.com",
    ]);
}

$teacher = mln_user($gen, 'teacher', 'Tess', 'Teacher', TEACHER_PASSWORD);
$learners = [];
foreach ($learnerNames as $i => [$first, $last]) {
    $learners[] = mln_user($gen, sprintf('learner%02d', $i + 1), $first, $last, LEARNER_PASSWORD);
}

$now = time();
foreach (['AWD101', 'JS101', 'REACT101'] as $ci => $shortname) {
    $course = $DB->get_record('course', ['shortname' => $shortname]);
    if (!$course) {
        echo "Skipping $shortname (not found)\n";
        continue;
    }
    $context = context_course::instance($course->id);
    if (!is_enrolled($context, $teacher)) {
        $gen->enrol_user($teacher->id, $course->id, 'editingteacher');
    }

    $completion = new completion_info($course);
    $activities = array_values(array_filter(
        $completion->get_activities(),
        fn($cm) => $cm->completion == COMPLETION_TRACKING_MANUAL && $cm->visible
    ));

    foreach ($learners as $li => $learner) {
        if (is_enrolled($context, $learner)) {
            continue;
        }
        $gen->enrol_user($learner->id, $course->id, 'student');

        // A spread of progress, different in each course.
        $share = (($li * 7 + $ci * 5) % 11) / 10; // 0 … 1
        $count = (int) round(min(1, $share) * count($activities));
        foreach (array_slice($activities, 0, $count) as $cm) {
            $completion->update_state($cm, COMPLETION_COMPLETE, $learner->id);
        }

        // Last visit: learners 4 and 12 have never visited; the rest, 0 to about 30 days ago.
        if ($li !== 3 && $li !== 11) {
            $daysAgo = ($li * 5 + $ci * 3) % 31;
            $DB->insert_record('user_lastaccess', (object) [
                'userid' => $learner->id, 'courseid' => $course->id, 'timeaccess' => $now - $daysAgo * DAYSECS - 3600,
            ]);
        }
    }
    echo "$shortname {$course->fullname}: teacher + " . count($learners) . " learners, " . count($activities) . " tracked activities\n";
}

echo "Done. Log in to MyLearning as \"teacher\" (or as an admin) and open one of these courses.\n";
