CREATE TABLE `guests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`space_id` integer NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `queues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`space_id` integer NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`ticket_prefix` text NOT NULL,
	`is_open` integer DEFAULT true NOT NULL,
	`default_mins_per_group` integer DEFAULT 5 NOT NULL,
	`key_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `queues_slug_uq` ON `queues` (`space_id`,`slug`);--> statement-breakpoint
CREATE TABLE `spaces` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`owner_email` text NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`is_open` integer DEFAULT true NOT NULL,
	`max_lines_per_guest` integer DEFAULT 3 NOT NULL,
	`key_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spaces_slug_unique` ON `spaces` (`slug`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`queue_id` integer NOT NULL,
	`guest_id` integer,
	`service_date` text NOT NULL,
	`ticket_number` integer NOT NULL,
	`public_token` text NOT NULL,
	`name` text NOT NULL,
	`party_size` integer,
	`status` text DEFAULT 'waiting' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`called_at` integer,
	`served_at` integer,
	`closed_at` integer,
	FOREIGN KEY (`queue_id`) REFERENCES `queues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_public_token_unique` ON `tickets` (`public_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_number_uq` ON `tickets` (`queue_id`,`service_date`,`ticket_number`);--> statement-breakpoint
CREATE INDEX `tickets_queue_idx` ON `tickets` (`queue_id`,`status`);--> statement-breakpoint
CREATE INDEX `tickets_guest_idx` ON `tickets` (`guest_id`,`status`);