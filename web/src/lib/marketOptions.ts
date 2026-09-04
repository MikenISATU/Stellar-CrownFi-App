import { countryCodeFor } from "@/lib/countries";

export const MAX_MARKET_OPTIONS = 256;

export type ParsedOutcome = { label: string; flagCode: string };

function parseDelimitedRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function rowFor(line: string): string[] {
  const delimiter = line.includes("\t") ? "\t" : line.includes("|") ? "|" : ",";
  return parseDelimitedRow(line, delimiter);
}

export function parseOutcomeList(text: string): ParsedOutcome[] {
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map(rowFor);
  if (!rows.length) return [];

  const header = rows[0].map((cell) => cell.toLocaleLowerCase());
  const labelIndex = header.findIndex((cell) => ["outcome", "candidate", "choice", "name"].includes(cell));
  const countryIndex = header.findIndex((cell) => ["country", "flag", "nation"].includes(cell));
  const hasHeader = labelIndex >= 0 || countryIndex >= 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows.map((row) => {
    if (hasHeader) {
      return {
        label: String(row[labelIndex >= 0 ? labelIndex : (countryIndex === 0 ? 1 : 0)] ?? "").trim(),
        flagCode: countryCodeFor(row[countryIndex]),
      };
    }
    const firstCountry = countryCodeFor(row[0]);
    const secondCountry = countryCodeFor(row[1]);
    if (firstCountry && row[1]) return { label: row[1].trim(), flagCode: firstCountry };
    if (secondCountry) return { label: row[0].trim(), flagCode: secondCountry };
    return { label: row[0].trim(), flagCode: "" };
  }).filter((outcome) => outcome.label).slice(0, MAX_MARKET_OPTIONS);
}

export function binaryOutcomeSymbol(label?: string | null): "yes" | "no" | null {
  const normalized = String(label ?? "").trim().toLocaleLowerCase().replace(/[.!?]/g, "");
  if (["yes", "true", "will happen"].includes(normalized)) return "yes";
  if (["no", "false", "will not happen", "won't happen"].includes(normalized)) return "no";
  return null;
}
