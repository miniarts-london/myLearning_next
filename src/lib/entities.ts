// Moodle sends plain-text names (course, category, section and activity names, people's names)
// with special characters escaped for HTML: "Business &amp; Careers". The app shows text as text
// (React escapes it), so those codes would appear on screen. These turn them back into characters.

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
    }
    return NAMED[code.toLowerCase()] ?? match;
  });
}

// The fields Moodle formats as escaped plain text. HTML fields (summaries, descriptions, page
// content) are left alone: they're cleaned and shown as HTML elsewhere.
const NAME_FIELDS = new Set(['name', 'fullname', 'shortname', 'displayname', 'categoryname', 'activityname', 'firstname', 'lastname']);

// Decodes the name fields anywhere in a Moodle response, however deeply nested.
export function decodeNames<T>(value: T): T {
  if (Array.isArray(value)) return value.map(decodeNames) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      out[key] = typeof v === 'string' && NAME_FIELDS.has(key) ? decodeEntities(v) : decodeNames(v);
    }
    return out as T;
  }
  return value;
}
