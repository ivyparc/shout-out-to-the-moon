import { readSheetSettings } from '../../../lib/moon/sheet-settings.mjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    return Response.json(await readSheetSettings(), { headers });
  } catch {
    return Response.json({ error: 'Unable to read Speed, Fuel and Money from the Google Sheet.' }, { status: 502, headers });
  }
}
