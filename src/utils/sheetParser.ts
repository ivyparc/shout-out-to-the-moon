export type SheetRow = Record<string, string>;

export function parseCsvByHeader(csv: string): SheetRow[] {
  const rows = parseCsv(csv);
  const [headers, ...body] = rows;

  if (!headers || headers.length === 0) {
    throw new Error("Google Sheet CSV has no header row.");
  }

  const normalizedHeaders = headers.map((header) => header.trim());
  const duplicateHeader = normalizedHeaders.find(
    (header, index) => normalizedHeaders.indexOf(header) !== index,
  );

  if (duplicateHeader) {
    throw new Error(`Google Sheet CSV has a duplicate header: ${duplicateHeader}`);
  }

  return body
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row) => {
      const item: SheetRow = {};
      normalizedHeaders.forEach((header, index) => {
        item[header] = row[index] ?? "";
      });
      return item;
    });
}

export function getRequiredCell(row: SheetRow, headerName: string): string {
  const value = row[headerName];
  if (value === undefined) {
    throw new Error(`Required Google Sheet header is missing: ${headerName}`);
  }
  return value;
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const nextChar = csv[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}
