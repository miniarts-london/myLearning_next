<?php
// MyLearning Next: run the three seed scripts from the browser, for hosting without SSH.
//
// 1. Upload this file to your Moodle's web folder (next to config.php; in Moodle 5.1+ that's the
//    "public" folder) as mln-seed.php, and the three scripts into a folder next to it called
//    mln-seed/:  seed-moodle.php, seed-more-courses.php, seed-learners.php
// 2. Log in to Moodle as a site admin and open https://your-moodle/mln-seed.php
// 3. Press "Add the demo courses". It may take a minute or two. If it stops part-way (some hosts
//    limit how long a page can run), press it again: anything already created is skipped.
// 4. Delete mln-seed.php and the mln-seed/ folder afterwards.

require(__DIR__ . '/config.php');
require_once($CFG->libdir . '/completionlib.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->libdir . '/testing/generator/lib.php');

require_login();
if (!is_siteadmin()) {
    throw new \moodle_exception('nopermissions', 'error', '', 'run the MyLearning demo seed');
}

$PAGE->set_context(context_system::instance());
$PAGE->set_url(new moodle_url('/mln-seed.php'));
$PAGE->set_title('MyLearning demo data');
$PAGE->set_heading('MyLearning demo data');
echo $OUTPUT->header();

$scripts = ['seed-moodle.php', 'seed-more-courses.php', 'seed-learners.php'];
$missing = array_filter($scripts, fn($s) => !is_file(__DIR__ . "/mln-seed/$s"));
if ($missing) {
    echo $OUTPUT->notification('Upload these into a folder called mln-seed next to this file: ' . s(implode(', ', $missing)), 'error');
    echo $OUTPUT->footer();
    exit;
}

// Only on a deliberate button press (a POST with your session key), never just by opening the page.
if (!data_submitted() || !confirm_sesskey()) {
    echo html_writer::tag('p', 'This adds the demo categories, about 50 courses, a teacher and 15 learners, and enrols you (' .
        s($USER->username) . ') in some of the courses. Courses and users that already exist are skipped.');
    echo html_writer::start_tag('form', ['method' => 'post', 'action' => $PAGE->url->out(false)]);
    echo html_writer::empty_tag('input', ['type' => 'hidden', 'name' => 'sesskey', 'value' => sesskey()]);
    echo html_writer::tag('button', 'Add the demo courses', ['type' => 'submit', 'class' => 'btn btn-primary']);
    echo html_writer::end_tag('form');
    echo $OUTPUT->footer();
    exit;
}

core_php_time_limit::raise(0);
raise_memory_limit(MEMORY_HUGE);
define('MLN_WEB_SEED', true);
$username = $USER->username; // Enrol the admin who pressed the button

echo '<pre>';
foreach ($scripts as $script) {
    echo "== $script\n";
    flush();
    include(__DIR__ . "/mln-seed/$script");
    echo "\n";
}
echo '</pre>';
purge_all_caches();
echo $OUTPUT->notification('Finished. Caches purged. Now delete mln-seed.php and the mln-seed folder.', 'success');
echo $OUTPUT->footer();
