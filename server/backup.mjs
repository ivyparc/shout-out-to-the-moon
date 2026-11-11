// Private, owner-authorized snapshots. Never expose snapshot bodies to game visitors.
export const BACKUP_TABLES = ['moon_players', 'moon_runs', 'moon_scores', 'moon_time_scores', 'moon_flight_scores', 'moon_periods', 'moon_migrations', 'moon_limits'];
const PREFIX = 'leaderboard-backups/v1/';
const LATEST_KEY = `${PREFIX}latest.json`;
const ROW_LIMIT = 50001;
const MAX_BYTES = 24 * 1024 * 1024;
const digest = async body => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))), b => b.toString(16).padStart(2, '0')).join('');

export async function verifyBackup(bucket, key) {
  if (key !== LATEST_KEY && !/^leaderboard-backups\/v1\/\d{4}-\d{2}-\d{2}\.json$/.test(key || '')) throw new Error('Invalid backup key.');
  const object = await bucket.get(key);
  if (!object) throw new Error('Backup not found.');
  const body = await object.text();
  const sha256 = await digest(body);
  if (sha256 !== object.customMetadata?.sha256) throw new Error('Backup checksum mismatch.');
  const data = JSON.parse(body);
  for (const table of BACKUP_TABLES) {
    if (!Array.isArray(data.tables?.[table]) || data.tables[table].length !== data.counts?.[table]) throw new Error('Invalid backup table.');
  }
  return { verified: true, key, createdAt: data.createdAt, counts: data.counts, sha256, bytes: new TextEncoder().encode(body).byteLength };
}

export async function createBackup(db, bucket, now = new Date()) {
  if (!db || !bucket) throw new Error('Backup storage is unavailable.');
  const key = LATEST_KEY;
  const previous = await bucket.head(key);
  // One D1 batch is a transaction: all tables belong to the same snapshot.
  const results = await db.batch([
    db.prepare("SELECT name, type, sql FROM sqlite_master WHERE name LIKE 'moon_%' AND sql IS NOT NULL ORDER BY type DESC, name"),
    ...BACKUP_TABLES.map(table => db.prepare(`SELECT * FROM ${table} LIMIT ${ROW_LIMIT}`)),
  ]);
  if (results.some(r => r.success === false)) throw new Error('Database snapshot failed.');
  const tables = Object.fromEntries(BACKUP_TABLES.map((table, i) => [table, results[i + 1].results]));
  if (Object.values(tables).some(rows => !Array.isArray(rows) || rows.length >= ROW_LIMIT)) throw new Error('Backup exceeds snapshot limit; no partial backup was saved.');
  const counts = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length]));
  const body = JSON.stringify({ format: 'moon-leaderboard-backup', version: 1, createdAt: now.toISOString(), schema: results[0].results, counts, tables });
  if (new TextEncoder().encode(body).byteLength > MAX_BYTES) throw new Error('Backup exceeds size limit; no partial backup was saved.');
  const sha256 = await digest(body);
  // Atomic conditional replacement: a failed export/upload preserves the old backup.
  const saved = await bucket.put(key, body, { httpMetadata: { contentType: 'application/json' }, customMetadata: { sha256 }, onlyIf: previous ? { etagMatches: previous.etag } : { etagDoesNotMatch: '*' } });
  if (!saved) throw new Error('Another backup changed the latest snapshot; retry.');
  return verifyBackup(bucket, key);
}

export async function latestBackup(bucket) {
  if (!bucket) throw new Error('Backup storage is unavailable.');
  if (await bucket.head(LATEST_KEY)) return verifyBackup(bucket, LATEST_KEY);
  let cursor, latest;
  do {
    const page = await bucket.list({ prefix: PREFIX, cursor });
    for (const object of page.objects) if (!latest || object.key > latest) latest = object.key;
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return latest ? verifyBackup(bucket, latest) : { verified: false, message: 'No backup exists yet.' };
}
