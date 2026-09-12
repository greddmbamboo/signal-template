CREATE TABLE `search_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`payload` text,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `search_usage` (
	`month` text PRIMARY KEY NOT NULL,
	`used` integer DEFAULT 0 NOT NULL
);

