import { pgTable, uuid, varchar, timestamp, boolean, text, jsonb, pgEnum, index, integer } from 'drizzle-orm/pg-core';

export const playstyleEnum = pgEnum('playstyle', ['miner', 'warrior', 'explorer']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 64 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
  /**
   * Compte non-joueur : capitaine des Premiers, robot de debug.
   *
   * Les systèmes tenus par les Premiers sont de vrais empires — planètes,
   * flottes, défenses — et `planets.userId` est NOT NULL : un capitaine DOIT
   * donc être une ligne `users` pour que le code de flotte, de combat et
   * d'espionnage fonctionne sans chemin parallèle. Ce drapeau est le prix de
   * ce choix : sans lui, un pirate apparaîtrait dans les classements, le fil
   * de l'univers, le compteur de joueurs et le back-office.
   *
   * ⚠️ Toute requête qui énumère des JOUEURS doit filtrer `NOT isNpc`.
   */
  isNpc: boolean('is_npc').notNull().default(false),
  bannedAt: timestamp('banned_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  bio: text('bio'),
  avatarId: varchar('avatar_id', { length: 128 }),
  playstyle: playstyleEnum('playstyle'),
  seekingAlliance: boolean('seeking_alliance').notNull().default(false),
  theme: varchar('theme', { length: 16 }).notNull().default('dark'),
  profileVisibility: jsonb('profile_visibility').notNull().default({ bio: true, playstyle: true, stats: true }),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  previousLoginAt: timestamp('previous_login_at', { withTimezone: true }),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
});

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('email_verification_tokens_token_hash_idx').on(table.tokenHash),
  index('email_verification_tokens_user_id_idx').on(table.userId),
  index('email_verification_tokens_expires_at_idx').on(table.expiresAt),
]);

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('password_reset_tokens_token_hash_idx').on(table.tokenHash),
  index('password_reset_tokens_user_id_idx').on(table.userId),
  index('password_reset_tokens_expires_at_idx').on(table.expiresAt),
]);

export const loginEvents = pgTable('login_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  email: varchar('email', { length: 255 }).notNull(),
  success: boolean('success').notNull(),
  reason: varchar('reason', { length: 64 }),
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('login_events_user_id_idx').on(table.userId),
  index('login_events_email_idx').on(table.email),
  index('login_events_created_at_idx').on(table.createdAt),
]);

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('refresh_tokens_token_hash_idx').on(table.tokenHash),
  index('refresh_tokens_expires_at_idx').on(table.expiresAt),
]);
