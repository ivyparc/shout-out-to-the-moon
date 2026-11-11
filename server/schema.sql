CREATE TABLE `moon_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `moon_limits_expiry` ON `moon_limits` (`expires`);--> statement-breakpoint
CREATE TABLE `moon_migrations` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`player` text NOT NULL,
	`save` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`redeemed_at` integer,
	FOREIGN KEY (`player`) REFERENCES `moon_players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `moon_periods` (
	`id` integer PRIMARY KEY NOT NULL,
	`period` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `moon_players` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`name` text,
	`name_key` text,
	`rename_month` text DEFAULT '' NOT NULL,
	`rename_count` integer DEFAULT 0 NOT NULL,
	`speed` integer DEFAULT 10 NOT NULL,
	`fuel` integer DEFAULT 10 NOT NULL,
	`money` integer DEFAULT 10 NOT NULL,
	`coins` integer DEFAULT 0 NOT NULL,
	`tries` integer DEFAULT 0 NOT NULL,
	`migrated` integer DEFAULT 0 NOT NULL,
	`active_run` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `moon_token_hash` ON `moon_players` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `moon_name_key` ON `moon_players` (`name_key`);--> statement-breakpoint
CREATE TABLE `moon_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`player` text NOT NULL,
	`state` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`version` integer DEFAULT 0 NOT NULL,
	`settled` integer DEFAULT 0 NOT NULL,
	`consumed` integer DEFAULT 0 NOT NULL,
	`landed` integer DEFAULT 0 NOT NULL,
	`score` integer,
	FOREIGN KEY (`player`) REFERENCES `moon_players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `moon_runs_player` ON `moon_runs` (`player`,`started_at`);--> statement-breakpoint
CREATE TABLE `moon_scores` (
	`player` text NOT NULL,
	`period` text NOT NULL,
	`score` integer NOT NULL,
	`achieved_at` integer NOT NULL,
	PRIMARY KEY(`player`, `period`),
	FOREIGN KEY (`player`) REFERENCES `moon_players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `moon_ranking` ON `moon_scores` (`period`,`score`,`achieved_at`);
--> statement-breakpoint
CREATE TABLE `moon_time_scores` (
	`player` text NOT NULL,
	`period` text NOT NULL,
	`score` integer NOT NULL,
	`achieved_at` integer NOT NULL,
	PRIMARY KEY(`player`, `period`),
	FOREIGN KEY (`player`) REFERENCES `moon_players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `moon_time_ranking` ON `moon_time_scores` (`period`,`score`,`achieved_at`);--> statement-breakpoint
ALTER TABLE `moon_runs` ADD `arrival_at` integer;--> statement-breakpoint
ALTER TABLE `moon_runs` ADD `elapsed_ms` integer;

CREATE TABLE `moon_flight_scores` (
	`run_id` text PRIMARY KEY NOT NULL,
	`player` text NOT NULL,
	`period` text NOT NULL,
	`score` real NOT NULL,
	`distance` real NOT NULL,
	`elapsed_ms` integer NOT NULL,
	`landed` integer NOT NULL,
	`achieved_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `moon_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player`) REFERENCES `moon_players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `moon_flight_week_score` ON `moon_flight_scores` (`period`,`score`,`achieved_at`);--> statement-breakpoint
CREATE INDEX `moon_flight_player` ON `moon_flight_scores` (`player`,`period`);