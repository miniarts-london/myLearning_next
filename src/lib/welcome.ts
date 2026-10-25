// The welcome animation after logging in.

// Set at login, holding the user's first name (for "Welcome back, Sam"); the first page after it
// plays the animation and clears it. Not a secret: the page's script reads it.
export const WELCOME_COOKIE = 'mylearning_welcome';

// The first name from the welcome cookie, or null when no welcome is due. Browser only.
export function welcomeName(): string | null {
  const entry = document.cookie.split('; ').find((c) => c.startsWith(`${WELCOME_COOKIE}=`));
  const value = entry?.slice(WELCOME_COOKIE.length + 1);
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

// Runs in the page before it's drawn: if the welcome is due (and motion is allowed), hide the page.
// The intro shows it again once the horse has landed, or after 12 seconds whatever happens.
export const WELCOME_EARLY_SCRIPT =
  `if(/(^|; )mylearning_welcome=[^;]/.test(document.cookie)&&!matchMedia('(prefers-reduced-motion: reduce)').matches){` +
  `document.documentElement.setAttribute('data-welcome','');setTimeout(function(){document.documentElement.removeAttribute('data-welcome')},12000)}`;

// While the animation plays, <html data-welcome> hides the page (the header and main content) so
// it can fade in once the horse has landed. See globals.css. Browser only.
const SAFETY_MS = 12_000; // Never leave the page hidden, whatever happens

let safety: ReturnType<typeof setTimeout> | undefined;

export function setWelcoming(on: boolean) {
  clearTimeout(safety);
  if (on && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return; // No animation: nothing to hide
  document.documentElement.toggleAttribute('data-welcome', on);
  if (on) safety = setTimeout(() => document.documentElement.removeAttribute('data-welcome'), SAFETY_MS);
}
