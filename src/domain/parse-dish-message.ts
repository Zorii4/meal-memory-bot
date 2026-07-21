export interface ParsedDishMessage {
  name: string;
  details: string | null;
}

/**
 * Splits an add-dish message into its title and optional non-empty detail lines.
 */
export function parseDishMessage(message: string): ParsedDishMessage {
  const [name = "", ...detailLines] = message.split(/\r?\n/);
  const details = detailLines.filter((line) => line.trim().length > 0).join("\n");

  return {
    name,
    details: details.length > 0 ? details : null
  };
}
