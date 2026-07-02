/**
 * Server-side text obfuscation for premium-gated content.
 *
 * Type-preserving, non-reversible scramble, UNICODE-AWARE: an uppercase letter
 * becomes a random uppercase ASCII letter, a lowercase letter a random lowercase
 * one, any caseless letter (CJK, Arabic, Hebrew, …) a random lowercase letter,
 * and any digit a random ASCII digit; whitespace, punctuation, symbols and emoji
 * are left as-is. Accented Latin, Cyrillic, Greek, CJK, full-width digits, etc.
 * are ALL scrambled — an earlier ASCII-only version silently passed non-English
 * text through verbatim, so "raw text never reaches the browser" was false for
 * localized content. Word/segment length is roughly preserved so garbled copy
 * still lays out like prose.
 *
 * Unlike a fixed substitution cipher, the mapping is random per character with
 * no key, so the original cannot be recovered from the output. Garble locked
 * content with this BEFORE it is serialized to the client and the raw text never
 * reaches the browser — the gate is enforced server-side, not merely hidden
 * (a client-side blur/cipher still ships the real strings in the DOM/props).
 *
 * Pure and framework-free (uses `Math.random`, fine in the server runtime), so
 * it can back any gated surface, not just the Ideas vertical.
 */

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";

function randomFrom(chars: string): string {
  // charAt always returns a string (never undefined), so no non-null assertion.
  return chars.charAt(Math.floor(Math.random() * chars.length));
}

/** Scramble one character, preserving its broad category (see module docs). */
function obfuscateChar(ch: string): string {
  if (/\p{Lu}/u.test(ch)) return randomFrom(UPPER); // uppercase letter
  if (/\p{Ll}/u.test(ch)) return randomFrom(LOWER); // lowercase letter
  if (/\p{N}/u.test(ch)) return randomFrom(DIGITS); // any numeric (incl. full-width)
  if (/\p{L}/u.test(ch)) return randomFrom(LOWER); // caseless letter (CJK, Arabic, …)
  return ch; // whitespace, punctuation, symbols, emoji
}

/** Type-preserving, non-reversible obfuscation of a string. */
export function obfuscateText(text: string): string {
  let out = "";
  for (const ch of text) out += obfuscateChar(ch);
  return out;
}
