import 'server-only';

// Who receives "contact the admin" requests: a Moodle user id, from MOODLE_SUPPORT_USERID.
// Defaults to 2, the admin account Moodle creates when it's installed.
export function supportUserId(): number {
  const id = Number(process.env.MOODLE_SUPPORT_USERID ?? 2);
  return Number.isInteger(id) && id > 0 ? id : 2;
}

// Moodle users never listed as learners: site admins who enrol themselves in courses to try them.
// Moodle doesn't tell teachers who is a site admin, so they're named here: MOODLE_ADMIN_USERIDS
// (comma-separated ids), plus the MOODLE_SUPPORT_USERID that receives access requests.
export function adminUserIds(): Set<number> {
  const ids = (process.env.MOODLE_ADMIN_USERIDS ?? '').split(',').map((s) => Number(s.trim()));
  return new Set([...ids, supportUserId()].filter((id) => Number.isInteger(id) && id > 0));
}

// How long before the same learner can ask about the same course again (default: a day).
export function cooldownMs(): number {
  const seconds = Number(process.env.ACCESS_REQUEST_COOLDOWN_SECONDS ?? 86400);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 86400 * 1000;
}
