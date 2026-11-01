// Turns the free-text profile fields (citizenship, languages) into flag badges for the sidebar.

export type FlagCode = "vn" | "fr" | "de" | "gb" | "us" | "es" | "it";

export interface FlagBadge {
  code: FlagCode;
  label: string;
}

interface Rule {
  pattern: RegExp;
  code: FlagCode;
  label: string;
}

const CITIZENSHIP_RULES: Rule[] = [
  { pattern: /vietnam/i, code: "vn", label: "Vietnamese" },
  { pattern: /france|french|français/i, code: "fr", label: "French" },
  { pattern: /german/i, code: "de", label: "German" },
  { pattern: /\b(usa|u\.s\.|american|united states)\b/i, code: "us", label: "American" },
  { pattern: /\b(uk|british|united kingdom)\b/i, code: "gb", label: "British" },
  { pattern: /spain|spanish/i, code: "es", label: "Spanish" },
  { pattern: /ital/i, code: "it", label: "Italian" },
];

const LANGUAGE_RULES: Rule[] = [
  { pattern: /english/i, code: "gb", label: "English" },
  { pattern: /french|français/i, code: "fr", label: "French" },
  { pattern: /vietnamese/i, code: "vn", label: "Vietnamese" },
  { pattern: /german|deutsch/i, code: "de", label: "German" },
  { pattern: /spanish|español/i, code: "es", label: "Spanish" },
  { pattern: /italian/i, code: "it", label: "Italian" },
];

/** Flags in the order the countries or languages appear in the text. */
function match(text: string, rules: Rule[]): FlagBadge[] {
  return rules
    .map((r) => ({ index: text.search(r.pattern), badge: { code: r.code, label: r.label } }))
    .filter((m) => m.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((m) => m.badge);
}

export const citizenshipFlags = (text: string) => match(text, CITIZENSHIP_RULES);
export const languageFlags = (text: string) => match(text, LANGUAGE_RULES);
