// Issue a one-time transfer only after the administrator reviews the saved stats.
// The approval file contains { playerId, save: { speed, fuel, money, coins }, reason }.
import { readFile } from 'node:fs/promises';
const path = process.argv[2];
const token = process.env.MOON_ADMIN_SECRET;
const endpoint = 'https://shout-moon-playtest-ivy.fancyolm1.chatgpt.site/api/leaderboard';
if (!path || !token || token.length < 32) throw new Error('Supply a reviewed approval JSON file and MOON_ADMIN_SECRET in the environment.');
const approval = JSON.parse(await readFile(path, 'utf8'));
const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ ...approval, namespace: 'shout-out-to-the-moon', scope: 'default', action: 'admin_migration' }) });
const result = await response.json();
if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
// Share this target-bound, 24-hour, single-use code only with the approved player.
console.log(JSON.stringify({ code: result.code, expiresAt: result.expiresAt }, null, 2));
