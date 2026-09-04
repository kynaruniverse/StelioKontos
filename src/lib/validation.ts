/**
 * Simple validation and sanitization helpers for future user input.
 * Use these whenever you add forms, API endpoints, or any external data.
 */

/** Trim and remove control characters from a string. */
export function sanitizeString(input: string, maxLength = 500): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[\u0000-\u001F\u007F]/g, "") // remove control chars
    .trim()
    .slice(0, maxLength);
}

/** Basic email format validation. */
export function isValidEmail(email: string): boolean {
  const sanitized = sanitizeString(email, 254);
  // Simple regex, adjust as needed
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized);
}

/** Ensure a value is a valid number within a range. */
export function sanitizeNumber(
  input: unknown,
  min = 0,
  max = 1000000,
  fallback = 0
): number {
  const num = Number(input);
  if (Number.isNaN(num) || !Number.isFinite(num)) return fallback;
  return Math.min(Math.max(num, min), max);
}

/** Escape HTML special characters to prevent XSS when rendering user content. */
export function escapeHtml(input: string): string {
  const sanitized = sanitizeString(input, 1000);
  return sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Validate a username-like string: alphanumeric, underscores, hyphens. */
export function isValidUsername(input: string, min = 3, max = 20): boolean {
  const sanitized = sanitizeString(input, max);
  if (sanitized.length < min || sanitized.length > max) return false;
  return /^[a-zA-Z0-9_-]+$/.test(sanitized);
}