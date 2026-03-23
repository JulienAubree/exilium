import { pgTable, varchar, text } from 'drizzle-orm/pg-core';

export const uiLabels = pgTable('ui_labels', {
  key: varchar('key', { length: 128 }).primaryKey(),
  label: text('label').notNull(),
});
