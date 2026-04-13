import { pgTable, text, integer, serial, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Daily check-in: energy + mood + intention
export const checkins = pgTable("checkins", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(), // YYYY-MM-DD
  energy: integer("energy").notNull(), // 1-5
  mood: integer("mood").notNull(), // 1-5
  intention: text("intention").notNull(), // what they want to focus on today
  gratitude: text("gratitude"), // optional grounding anchor
});

export const insertCheckinSchema = createInsertSchema(checkins).omit({ id: true });
export type InsertCheckin = z.infer<typeof insertCheckinSchema>;
export type Checkin = typeof checkins.$inferSelect;

// Tasks: broken into ridiculously small steps
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull().default("general"), // e.g. job-apps, consulting, personal
  priority: text("priority").notNull().default("medium"), // low | medium | high | urgent
  status: text("status").notNull().default("todo"), // todo | in-progress | done | parked
  estimatedMinutes: integer("estimated_minutes").default(25),
  notes: text("notes"),
  dueDate: text("due_date"), // YYYY-MM-DD optional
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
  order: integer("order").default(0),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, completedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Focus sessions: Pomodoro-style timed blocks
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id"), // optional link to a task
  taskTitle: text("task_title"), // denormalized for display
  durationMinutes: integer("duration_minutes").notNull().default(25),
  breakMinutes: integer("break_minutes").notNull().default(5),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  interrupted: boolean("interrupted").default(false),
  notes: text("notes"),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, completedAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;
