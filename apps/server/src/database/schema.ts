import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

/**
 * Auth users table - local authentication (username/password via SRP-6a)
 */
export const authUsers = pgTable('auth_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  // SRP-6a: store salt and verifier, never the password
  srpSalt: text('srp_salt').notNull(),
  srpVerifier: text('srp_verifier').notNull(),
  // Bound Riot ID (format: "GameName#TagLine")
  riotId: text('riot_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, table => [
  index('auth_users_username_idx').on(table.username),
])

/**
 * Users table - stores authenticated Riot users
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  puuid: text('puuid').notNull().unique(),
  gameName: text('game_name').notNull(),
  tagLine: text('tag_line').notNull(),
  region: text('region').default('ap'),
  // Encrypted Riot auth data (access_token, entitlements_token, etc.)
  encryptedAuthData: text('encrypted_auth_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, table => [
  index('users_puuid_idx').on(table.puuid),
])

/**
 * Favorites table - users' favorite players to track
 */
export const favorites = pgTable('favorites', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetPuuid: text('target_puuid').notNull(),
  targetName: text('target_name').notNull(),
  targetTag: text('target_tag').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [
  index('favorites_user_id_idx').on(table.userId),
  unique('favorites_user_target_unique').on(table.userId, table.targetPuuid),
])

/**
 * Search history table - recent player searches
 */
export const searchHistory = pgTable('search_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  searchName: text('search_name').notNull(),
  searchTag: text('search_tag').notNull(),
  resultPuuid: text('result_puuid'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [
  index('search_history_user_id_idx').on(table.userId),
  index('search_history_created_at_idx').on(table.createdAt),
])

// Type exports for use in services
export type AuthUser = typeof authUsers.$inferSelect
export type NewAuthUser = typeof authUsers.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Favorite = typeof favorites.$inferSelect
export type NewFavorite = typeof favorites.$inferInsert
export type SearchHistoryEntry = typeof searchHistory.$inferSelect
export type NewSearchHistoryEntry = typeof searchHistory.$inferInsert
