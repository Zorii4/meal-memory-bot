/**
 * Produces the canonical form used to identify duplicate dish names.
 */
export function normalizeDishName(name: string): string {
  return name.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}
