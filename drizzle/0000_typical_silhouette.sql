CREATE TABLE `jobs` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`source` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'inbox' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`first_seen` text NOT NULL,
	`last_seen` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `preferences` (
	`owner` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
