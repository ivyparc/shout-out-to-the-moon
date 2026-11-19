const SHEET_EXPORT = 'https://docs.google.com/spreadsheets/d/1Z7Bft-n0MNSQMPITQEgAo0O_mGSvueM2QRrhg_HDNoA/export?format=csv&gid=0&range=A1:F9';

export function parseSheetSettings(csv) {
  const rows = csv.trim().split(/\r?\n/).map(row =>
    row.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(cell => cell.trim().replace(/^"|"$/g, ''))
  );
  const numeric = cell => cell?.trim() ? Number(cell.replaceAll(',', '')) : NaN;
  const rules = [
    { type: 'speed', row: 1, max: 10000, scale: 1 },
    { type: 'fuel', row: 4, max: 600, scale: 1 },
    { type: 'money', row: 7, max: 10000, scale: 10 },
  ];
  return Object.fromEntries(rules.map(({ type, row, max, scale }) => {
    if (!rows[row]?.[0]?.toLowerCase().startsWith(type) ||
        !rows[row + 1]?.[0]?.toLowerCase().startsWith('cost')) {
      throw new Error('Missing upgrade rows.');
    }
    const values = rows[row].slice(1, 6).map(numeric);
    const costs = rows[row + 1].slice(1, 6).map(numeric);
    if (values.length !== 5 || costs.length !== 5 ||
        values.some((value, i) => !Number.isSafeInteger(value * scale) || value <= 0 ||
          value > max || (i > 0 && value <= values[i - 1] && !(value === max && values[i - 1] === max))) ||
        costs.some((cost, i) => !(values[i] === max && rows[row + 1][i + 1] === 'Max') &&
          (!Number.isSafeInteger(cost) || cost < 0 || cost > 100000000))) {
      throw new Error('Invalid upgrade values.');
    }
    return [type, { values, costs: costs.map((cost, i) => values[i] === max ? null : cost) }];
  }));
}

export async function readSheetSettings(fetchRequest = fetch) {
  const response = await fetchRequest(SHEET_EXPORT, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
  if (!response.ok || !response.headers.get('content-type')?.includes('csv')) {
    throw new Error('Google Sheet could not be read.');
  }
  const csv = await response.text();
  if (csv.length > 20000) throw new Error('Upgrade table is too large.');
  return parseSheetSettings(csv);
}
