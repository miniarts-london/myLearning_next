// Which Moodle courses this platform shows. Several platforms can share one Moodle site, each with
// its own list: COURSE_IDS=1,2,3 on one and COURSE_IDS=1,3,4 on another. Unset or empty: every course.

/** The course ids in a COURSE_IDS value, or null for "every course". Anything that isn't a whole number above 0 is ignored. */
export function parseCourseIds(value: string | undefined): Set<number> | null {
  const ids = (value ?? '').split(',').map((part) => part.trim()).filter((part) => /^\d+$/.test(part)).map(Number).filter((id) => id > 0);
  return ids.length > 0 ? new Set(ids) : null;
}

/** Whether this platform shows the course with this id. */
export function onPlatform(courseId: number, ids: Set<number> | null = parseCourseIds(process.env.COURSE_IDS)): boolean {
  return ids === null || ids.has(courseId);
}
