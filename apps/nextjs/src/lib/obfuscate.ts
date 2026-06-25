/**
 * Server-side text obfuscation for premium-gated content.
 *
 * Type-preserving, non-reversible scramble: a lowercase letter becomes a random
 * lowercase letter, an uppercase letter a random uppercase letter, a digit a
 * random digit; whitespace, punctuation and every other symbol are left exactly
 * as-is. Word length and shape are preserved, so garbled copy still lays out
 * like the original prose — it's just unintelligible.
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

/** Scramble one character, preserving its category (see module docs). */
function obfuscateChar(ch: string): string {
  if (ch >= "a" && ch <= "z") return randomFrom(LOWER);
  if (ch >= "A" && ch <= "Z") return randomFrom(UPPER);
  if (ch >= "0" && ch <= "9") return randomFrom(DIGITS);
  return ch;
}

/** Type-preserving, non-reversible obfuscation of a string. */
export function obfuscateText(text: string): string {
  let out = "";
  for (const ch of text) out += obfuscateChar(ch);
  return out;
}
