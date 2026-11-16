CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`birth_date` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vip_memberships` (
	`user_id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vip_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`price` integer NOT NULL,
	`days` integer NOT NULL,
	`created_at` integer NOT NULL,
	`reviewed_at` integer,
	`reviewed_by` text
);
--> statement-breakpoint
CREATE TABLE `vip_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`price` integer NOT NULL,
	`days` integer NOT NULL,
	`bank` text NOT NULL,
	`account` text NOT NULL,
	`account_name` text NOT NULL,
	`updated_at` integer NOT NULL
);

ALTER TABLE `vip_requests` ADD `months` integer DEFAULT 1 NOT NULL;
CREATE TABLE `xp_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `vip_requests` ADD `purchase_xp` integer DEFAULT 0 NOT NULL;
CREATE TABLE `ad_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`display_unit` text NOT NULL,
	`interstitial_unit` text NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE TABLE `referral_codes` (
	`user_id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referral_code_unique` ON `referral_codes` (`code`);--> statement-breakpoint
CREATE TABLE `referrals` (
	`invitee_id` text PRIMARY KEY NOT NULL,
	`inviter_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `xp_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`cost` integer NOT NULL,
	`days` integer NOT NULL,
	`months` integer NOT NULL,
	`apply_token` text NOT NULL,
	`created_at` integer NOT NULL
);
