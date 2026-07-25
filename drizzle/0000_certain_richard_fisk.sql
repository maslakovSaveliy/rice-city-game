CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`type` text NOT NULL,
	`at` integer NOT NULL,
	`discount` integer,
	`taps` integer
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`phase` text NOT NULL,
	`grains` real NOT NULL,
	`total_grains` real NOT NULL,
	`taps` integer NOT NULL,
	`heat` real NOT NULL,
	`tap_budget` real NOT NULL,
	`upgrades` text NOT NULL,
	`started_at` integer,
	`ends_at` integer,
	`last_tick_at` integer,
	`fixed_at` integer,
	`fixed_discount` integer,
	`attempts` integer NOT NULL
);
