// Masks text that looks like a key or a token before reinwatch shows it. Only the look of the text is checked,
// so this is a guard against leaks by accident, not a guarantee.

const MASK = '[redacted]'

// Rules of [pattern, replacement], applied in this order; a replacement may keep a captured group. Applying the rules
// again never shows anything that was masked, and for the usual shapes it gives the same text.
// A name and a URL's scheme come before the generic run, so they stay readable when the value after them is long.
// The named key shapes do not start right after a letter or digit: "task-" or "disk-" does not begin an sk- key,
// but "my_" may come before a key.
const RULES: readonly (readonly [RegExp, string])[] = [
  // A value given to a name that ends in a secret word: the name and the sign stay, the value is masked.
  [/((?:password|passwd|pwd|secret[_-]?key(?:[_-]?base)?|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)["']?\s*[=:]\s*)(?:"[^"]*(?:"|$)|'[^']*(?:'|$)|[^\s"',;&]+)/gi, `$1${MASK}`],
  // The user part of a URL (a user, user:password or a token before the @). The lookbehind lets a scheme start only where a
  // run of scheme characters starts: one attempt per run keeps the rule linear on a long text.
  [/(?<![A-Za-z0-9+.-])([A-Za-z0-9+.-]+:\/\/)[^\s\/@]+@/g, `$1${MASK}@`],
  // The generic run goes first among the shapes, so a key with more key characters glued to it is masked whole.
  [/[A-Za-z0-9+\/=_-]{32,}/g, MASK],                        // any long unbroken run, such as a base64 or hex secret
  [/(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{8,}/g, MASK],          // API keys with an sk- prefix
  [/(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{20,}/g, MASK],    // GitHub tokens
  [/(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{20,}/g, MASK],  // GitHub fine-grained tokens
  [/(?<![A-Za-z0-9])A[KS]IA[0-9A-Z]{16}/g, MASK],           // AWS access key ids, long-lived (AKIA) and temporary (ASIA)
  [/(?<![A-Za-z0-9])xox[abposr]-[A-Za-z0-9-]{10,}/g, MASK], // Slack tokens
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, MASK],            // the first line of a PEM private key
]

export function redact(text: string): string {
  return RULES.reduce((masked, [pattern, replacement]) => masked.replace(pattern, replacement), text)
}
