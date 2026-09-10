import { integer, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
export const jobs = sqliteTable('jobs', {
 owner: text('owner').notNull(), id: text('id').notNull(), source: text('source').notNull(),
 payload: text('payload').notNull(), status: text('status').notNull().default('inbox'),
 reason: text('reason').notNull().default(''), coverLetter: text('cover_letter').notNull().default(''), linkedinUrl: text('linkedin_url').notNull().default(''), linkedinId: text('linkedin_id').notNull().default(''), firstSeen: text('first_seen').notNull(), lastSeen: text('last_seen').notNull(), active: integer('active').notNull().default(1),
}, t => [primaryKey({columns:[t.owner,t.id]})]);
export const preferences = sqliteTable('preferences', {owner:text('owner').primaryKey(), payload:text('payload').notNull()});
export const sources = sqliteTable('sources', {owner:text('owner').notNull(), id:text('id').notNull(), payload:text('payload').notNull()},t=>[primaryKey({columns:[t.owner,t.id]})]);
