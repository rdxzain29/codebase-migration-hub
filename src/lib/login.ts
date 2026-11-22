/**
 * Reader sign-in rules. Email + password accounts are limited to real Gmail and
 * Outlook / Hotmail / Live inboxes; the database enforces the same rule on sign-up.
 */
const ALLOWED_DOMAIN = /^(gmail\.com|googlemail\.com|msn\.com|(outlook|hotmail|live)\.[a-z]{2,3}(\.[a-z]{2})?)$/;

export function isAllowedLoginEmail(email: string): boolean {
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at < 1 || at !== value.indexOf("@")) return false;
  return ALLOWED_DOMAIN.test(value.slice(at + 1));
}

export const ALLOWED_EMAIL_HINT = "Use a Gmail or Outlook (Hotmail / Live) address.";

/** Same-origin path to return to after reader sign-in; anything unsafe goes home. */
export function safeReaderReturn(value: string | null | undefined, origin: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const base = new URL(origin);
    const target = new URL(value, base);
    if (target.origin !== base.origin) return "/";
    if (["/login", "/auth", "/reset-password"].some((p) => target.pathname === p || target.pathname.startsWith(`${p}/`))) {
      return "/";
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}
