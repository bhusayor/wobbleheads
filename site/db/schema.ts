import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const participants = sqliteTable('participants', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  xUsername: text('x_username'),
  wallet: text('wallet'),
  publicLeaderboard: integer('public_leaderboard').notNull().default(0),
  xp: integer('xp').notNull().default(0),
  badge: text('badge'),
  wlStatus: text('wl_status').notNull().default('none'),
  wlCategory: text('wl_category'),
  approvedAt: text('approved_at'),
  suspicious: integer('suspicious').notNull().default(0),
  createdAt: text('created_at').notNull(),
}, (table) => [uniqueIndex('idx_participants_wallet').on(table.wallet), index('idx_participants_xp').on(table.xp)]);

export const xpEvents = sqliteTable('xp_events', {
  id: text('id').primaryKey(),
  participantId: text('participant_id').notNull(),
  eventKey: text('event_key').notNull(),
  eventDate: text('event_date').notNull().default(''),
  xp: integer('xp').notNull(),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
}, (table) => [uniqueIndex('idx_xp_events_once').on(table.participantId, table.eventKey, table.eventDate), index('idx_xp_events_participant').on(table.participantId)]);

export const submissions = sqliteTable('submissions', {
  id: text('id').primaryKey(),
  participantId: text('participant_id').notNull(),
  taskKey: text('task_key').notNull(),
  content: text('content').notNull(),
  status: text('status').notNull().default('pending'),
  note: text('note'),
  reviewedBy: text('reviewed_by'),
  createdAt: text('created_at').notNull(),
}, (table) => [uniqueIndex('idx_submissions_once').on(table.participantId, table.taskKey), index('idx_submissions_status').on(table.status)]);

export const savedHeads = sqliteTable('saved_heads', {
  id: text('id').primaryKey(),
  participantId: text('participant_id').notNull(),
  name: text('name').notNull(),
  traits: text('traits').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_saved_heads_participant').on(table.participantId)]);

export const referrals = sqliteTable('referrals', {
  referredId: text('referred_id').primaryKey(),
  referrerId: text('referrer_id').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_referrals_referrer').on(table.referrerId)]);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
