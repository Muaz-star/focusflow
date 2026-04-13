import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { checkins, tasks, sessions } from "@shared/schema";
import type { InsertCheckin, Checkin, InsertTask, Task, InsertSession, Session } from "@shared/schema";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

const db = drizzle(pool);

// Create tables if they don't exist (runs on startup)
export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS checkins (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      energy INTEGER NOT NULL,
      mood INTEGER NOT NULL,
      intention TEXT NOT NULL,
      gratitude TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'todo',
      estimated_minutes INTEGER DEFAULT 25,
      notes TEXT,
      due_date TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      "order" INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      task_id INTEGER,
      task_title TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 25,
      break_minutes INTEGER NOT NULL DEFAULT 5,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      interrupted BOOLEAN DEFAULT FALSE,
      notes TEXT
    );
  `);
}

export interface IStorage {
  // Checkins
  getTodayCheckin(date: string): Promise<Checkin | undefined>;
  createCheckin(data: InsertCheckin): Promise<Checkin>;
  getRecentCheckins(limit: number): Promise<Checkin[]>;

  // Tasks
  getAllTasks(): Promise<Task[]>;
  getTasksByStatus(status: string): Promise<Task[]>;
  createTask(data: InsertTask): Promise<Task>;
  updateTask(id: number, data: Partial<Task>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<void>;

  // Sessions
  getAllSessions(): Promise<Session[]>;
  createSession(data: InsertSession): Promise<Session>;
  completeSession(id: number, notes?: string): Promise<Session | undefined>;
  getRecentSessions(limit: number): Promise<Session[]>;

  // Weekly review
  getWeeklyData(startDate: string, endDate: string): Promise<{
    checkinsByDate: Checkin[];
    completedTasks: Task[];
    sessionsByDate: Session[];
  }>;
}

export const storage: IStorage = {
  // Checkins
  async getTodayCheckin(date: string) {
    const rows = await db.select().from(checkins).where(eq(checkins.date, date));
    return rows[0];
  },
  async createCheckin(data: InsertCheckin) {
    const rows = await db.insert(checkins).values(data).returning();
    return rows[0];
  },
  async getRecentCheckins(limit: number) {
    return db.select().from(checkins).orderBy(desc(checkins.id)).limit(limit);
  },

  // Tasks
  async getAllTasks() {
    return db.select().from(tasks).orderBy(tasks.order, tasks.id);
  },
  async getTasksByStatus(status: string) {
    return db.select().from(tasks).where(eq(tasks.status, status)).orderBy(tasks.order, tasks.id);
  },
  async createTask(data: InsertTask) {
    const now = new Date().toISOString();
    const rows = await db.insert(tasks).values({ ...data, createdAt: now }).returning();
    return rows[0];
  },
  async updateTask(id: number, data: Partial<Task>) {
    const rows = await db.update(tasks).set(data).where(eq(tasks.id, id)).returning();
    return rows[0];
  },
  async deleteTask(id: number) {
    await db.delete(tasks).where(eq(tasks.id, id));
  },

  // Sessions
  async getAllSessions() {
    return db.select().from(sessions).orderBy(desc(sessions.id));
  },
  async createSession(data: InsertSession) {
    const now = new Date().toISOString();
    const rows = await db.insert(sessions).values({ ...data, startedAt: now }).returning();
    return rows[0];
  },
  async completeSession(id: number, notes?: string) {
    const now = new Date().toISOString();
    const rows = await db.update(sessions).set({ completedAt: now, notes }).where(eq(sessions.id, id)).returning();
    return rows[0];
  },
  async getRecentSessions(limit: number) {
    return db.select().from(sessions).orderBy(desc(sessions.id)).limit(limit);
  },

  // Weekly review
  async getWeeklyData(startDate: string, endDate: string) {
    const checkinsByDate = await db.select().from(checkins)
      .where(and(gte(checkins.date, startDate), lte(checkins.date, endDate)))
      .orderBy(checkins.date);

    const completedTasks = await db.select().from(tasks)
      .where(and(
        eq(tasks.status, "done"),
        gte(sql`substr(${tasks.completedAt}, 1, 10)`, startDate),
        lte(sql`substr(${tasks.completedAt}, 1, 10)`, endDate)
      ))
      .orderBy(tasks.completedAt);

    const sessionsByDate = await db.select().from(sessions)
      .where(and(
        eq(sessions.interrupted, false),
        gte(sql`substr(${sessions.startedAt}, 1, 10)`, startDate),
        lte(sql`substr(${sessions.startedAt}, 1, 10)`, endDate)
      ))
      .orderBy(sessions.startedAt);

    return { checkinsByDate, completedTasks, sessionsByDate };
  },
};
