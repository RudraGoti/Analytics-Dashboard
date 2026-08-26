import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const dailyExpenses = pgTable("daily_expenses", {
  id: serial().primaryKey(),
  date: text().notNull().unique(),
  counter: integer().notNull(),
  expenses: jsonb().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
