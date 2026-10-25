// The welcome animation after logging in.

// Set at login; the first page after it plays the animation and clears it.
export const WELCOME_COOKIE = 'mylearning_welcome';

// Runs in the page before it's drawn: if the welcome is due (and motion is allowed), hide the page.
// The intro shows it again once the horse has landed, or after 12 seconds whatever happens.
export const WELCOME_EARLY_SCRIPT =
  `if(document.cookie.indexOf('${'mylearning_welcome'}=1')>-1&&!matchMedia('(prefers-reduced-motion: reduce)').matches){` +
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
