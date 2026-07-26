// formatTenge (lib/format.ts) uses Intl.NumberFormat("ru-RU"), whose thousands
// separator is a non-breaking space (U+00A0). @testing-library/dom's exact
// string matcher normalizes whitespace on the rendered DOM text but not on the
// string passed to getByText, so a raw NBSP-containing search string never
// matches. Collapse whitespace here the same way the DOM-side normalizer
// does, so the comparison is apples-to-apples.
export function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ");
}
