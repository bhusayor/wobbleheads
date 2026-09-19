CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`x_username` text,
	`wallet` text,
	`public_leaderboard` integer DEFAULT 0 NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`badge` text,
	`wl_status` text DEFAULT 'none' NOT NULL,
	`wl_category` text,
	`approved_at` text,
	`suspicious` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_participants_wallet` ON `participants` (`wallet`);--> statement-breakpoint
CREATE INDEX `idx_participants_xp` ON `participants` (`xp`);--> statement-breakpoint
CREATE TABLE `referrals` (
	`referred_id` text PRIMARY KEY NOT NULL,
	`referrer_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_referrals_referrer` ON `referrals` (`referrer_id`);--> statement-breakpoint
CREATE TABLE `saved_heads` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`name` text NOT NULL,
	`traits` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_saved_heads_participant` ON `saved_heads` (`participant_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`task_key` text NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`note` text,
	`reviewed_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_submissions_once` ON `submissions` (`participant_id`,`task_key`);--> statement-breakpoint
CREATE INDEX `idx_submissions_status` ON `submissions` (`status`);--> statement-breakpoint
CREATE TABLE `xp_events` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`event_key` text NOT NULL,
	`event_date` text DEFAULT '' NOT NULL,
	`xp` integer NOT NULL,
	`metadata` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_xp_events_once` ON `xp_events` (`participant_id`,`event_key`,`event_date`);--> statement-breakpoint
CREATE INDEX `idx_xp_events_participant` ON `xp_events` (`participant_id`);