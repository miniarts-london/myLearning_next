// The welcome animation after logging in.

// Set at login; the first page after it plays the animation and clears it.
export const WELCOME_COOKIE = 'mylearning_welcome';

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
