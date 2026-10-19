import sanitizeHtml from 'sanitize-html';
import { fileUrl } from '@/lib/files';
import { appHrefFor } from '@/lib/links';

// Course, section and activity content comes from Moodle as HTML. Clean it before rendering,
// route Moodle file links through /api/file so images load without exposing the token,
// and point links to Moodle pages at this app's own pages so learners stay here.
export function SafeHtml({ html, className }: { html: string; className?: string }) {
  if (!html?.trim()) {
    return null;
  }
  const clean = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
    },
    transformTags: {
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, src: attribs.src?.includes('pluginfile.php') ? fileUrl(attribs.src) ?? '' : attribs.src },
      }),
      a: (tagName, attribs): sanitizeHtml.Tag => {
        const href = attribs.href ?? '';
        if (href.includes('pluginfile.php')) {
          return { tagName, attribs: { ...attribs, href: fileUrl(href) ?? '' } };
        }
        const inApp = appHrefFor(href);
        if (inApp) {
          return { tagName, attribs: { href: inApp } };
        }
        // Anything else is an outside site: open it in a new tab so this app stays open.
        if (/^https?:\/\//.test(href)) {
          return { tagName, attribs: { href, target: '_blank', rel: 'noopener noreferrer' } };
        }
        return { tagName, attribs: { href } };
      },
    },
  });
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
