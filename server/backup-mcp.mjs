import { createBackup, latestBackup } from './backup.mjs';
// Owner verified from Sites access policy. Platform supplies authenticated identity.
const OWNER_EMAIL = 'kang12365@gmail.com';
const toolList = [
  { name: 'backup_leaderboard', description: 'Create and verify a private backup of Moon leaderboard data. Owner only. Atomically overwrites the single latest backup.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'check_leaderboard_backup', description: 'Verify the latest private Moon leaderboard backup and return metadata only. Owner only.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
];
export async function handleBackupMcp(request, env) {
  const json = payload => Response.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  let rpc;
  try { rpc = await request.json(); } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON' } }); }
  const id = rpc.id ?? null;
  const result = value => json({ jsonrpc: '2.0', id, result: value });
  if (rpc.method === 'server/discover') return result({ supportedVersions: ['2026-07-28'], capabilities: { tools: {} } });
  if (rpc.method === 'initialize') return result({ protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'moon-backups', version: '1.0.0' } });
  if (rpc.method === 'notifications/initialized') return new Response(null, { status: 202 });
  if (rpc.method === 'tools/list') return result({ tools: toolList });
  if (rpc.method !== 'tools/call') return json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
  const fail = message => result({ isError: true, content: [{ type: 'text', text: message }] });
  if (!request.headers.get('oai-authenticated-user-id') || request.headers.get('oai-authenticated-user-email')?.toLowerCase() !== OWNER_EMAIL) return fail('Only the Site owner can manage backups.');
  try {
    let data;
    if (rpc.params?.name === 'backup_leaderboard') data = await createBackup(env.DB, env.BACKUPS);
    else if (rpc.params?.name === 'check_leaderboard_backup') data = await latestBackup(env.BACKUPS);
    else return fail('Unknown tool.');
    return result({ content: [{ type: 'text', text: JSON.stringify(data) }] });
  } catch (error) {
    console.error('Leaderboard backup failed:', error.message);
    return fail('Backup failed. Check server logs; do not consider this run successful.');
  }
}
