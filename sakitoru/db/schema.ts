import {sqliteTable,text,integer,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const profiles=sqliteTable('profiles',{userId:text('user_id').primaryKey(),displayName:text('display_name').notNull(),birthDate:text('birth_date').notNull(),createdAt:integer('created_at').notNull()});
export const vipMemberships=sqliteTable('vip_memberships',{userId:text('user_id').primaryKey(),expiresAt:integer('expires_at').notNull(),updatedAt:integer('updated_at').notNull()});
export const vipSettings=sqliteTable('vip_settings',{id:integer('id').primaryKey(),price:integer('price').notNull(),days:integer('days').notNull(),bank:text('bank').notNull(),account:text('account').notNull(),accountName:text('account_name').notNull(),updatedAt:integer('updated_at').notNull()});
export const vipRequests=sqliteTable('vip_requests',{id:text('id').primaryKey(),userId:text('user_id').notNull(),status:text('status').notNull(),price:integer('price').notNull(),days:integer('days').notNull(),months:integer('months').notNull().default(1),purchaseXp:integer('purchase_xp').notNull().default(0),createdAt:integer('created_at').notNull(),reviewedAt:integer('reviewed_at'),reviewedBy:text('reviewed_by')});

export const xpLedger=sqliteTable('xp_ledger',{id:text('id').primaryKey(),userId:text('user_id').notNull(),amount:integer('amount').notNull(),reason:text('reason').notNull(),createdAt:integer('created_at').notNull()});

export const adSettings=sqliteTable('ad_settings',{id:integer('id').primaryKey(),enabled:integer('enabled').notNull().default(0),displayUnit:text('display_unit').notNull(),interstitialUnit:text('interstitial_unit').notNull(),updatedAt:integer('updated_at').notNull()});

export const referralCodes=sqliteTable('referral_codes',{userId:text('user_id').primaryKey(),code:text('code').notNull()},t=>[uniqueIndex('referral_code_unique').on(t.code)]);
export const referrals=sqliteTable('referrals',{inviteeId:text('invitee_id').primaryKey(),inviterId:text('inviter_id').notNull(),createdAt:integer('created_at').notNull()});
export const xpRedemptions=sqliteTable('xp_redemptions',{id:text('id').primaryKey(),userId:text('user_id').notNull(),cost:integer('cost').notNull(),days:integer('days').notNull(),months:integer('months').notNull(),applyToken:text('apply_token').notNull(),createdAt:integer('created_at').notNull()});
