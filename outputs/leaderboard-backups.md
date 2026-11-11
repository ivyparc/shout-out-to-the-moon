# Private leaderboard backups

The existing Moon Site Worker exposes owner-only MCP tools `backup_leaderboard` and `check_leaderboard_backup`. Sites supplies verified caller identity; only the configured Site owner may call them. If ownership changes, update the server allowlist. Do not copy identity headers from a browser or invent them.

Snapshots are stored in the private R2 `BACKUPS` binding of the same Site, under `leaderboard-backups/v1/latest.json`. No public download route exists. No additional application server is created. Every successful run atomically replaces this single latest backup. Failed exports/uploads preserve the previous snapshot; concurrent replacements use an ETag condition. Historical snapshots from before this change are not automatically deleted. The owner requested an every-other-day midnight schedule in America/Toronto; the cloud schedule must be updated separately.

## Scheduled run

Use the Site's connected MCP plugin to call `backup_leaderboard` with no arguments, then `check_leaderboard_backup`. Success requires `verified: true`, a current snapshot timestamp, matching key and SHA-256, and row counts. Do not republish the Site or alter live game data. If the tool is unavailable, authorization fails, or verification fails, report failure; never claim a backup was saved. The cloud task must retain access to this private plugin.

The snapshot contains all eight Moon data tables (players, runs, legacy coin/time scores, flight scores, periods, migration records and rate limits) and their SQL schema. It contains sensitive account hashes and migration records; keep it private. A single D1 batch transaction captures the tables consistently. Readback checks SHA-256 and row counts. A failed/oversized snapshot is not accepted as a backup. Current bounded export supports fewer than 50,001 rows per table and up to 24 MiB serialized; enlarge/rework the exporter before exceeding these bounds.

## Restore procedure (manual, never scheduled)

Only restore at the owner's explicit request. Obtain the selected R2 object through authorized storage access, verify SHA-256 against object metadata and counts against each table, and preserve the current database first. Test the restore into an isolated SQLite database using the saved table schema, parameterized inserts, then indexes; check integrity and foreign keys. For live restoration, quiesce writes and use the approved database migration/restore tooling. Do not expose a public restore endpoint or return snapshot contents through MCP. Backups are separate objects, not protection against deletion of the entire Site/account. No restore has been performed as part of setup.
