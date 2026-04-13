import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertCheckinSchema, insertTaskSchema, insertSessionSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(httpServer: Server, app: Express) {

  // ─── Checkins ───────────────────────────────────────────────
  app.get("/api/checkin/today", async (req, res) => {
    const today = new Date().toISOString().split("T")[0];
    const checkin = await storage.getTodayCheckin(today);
    res.json(checkin || null);
  });

  app.post("/api/checkin", async (req, res) => {
    const result = insertCheckinSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.flatten() });
    const checkin = await storage.createCheckin(result.data);
    res.json(checkin);
  });

  app.get("/api/checkins/recent", async (req, res) => {
    const checkins = await storage.getRecentCheckins(14);
    res.json(checkins);
  });

  // ─── Tasks ──────────────────────────────────────────────────
  app.get("/api/tasks", async (req, res) => {
    const tasks = await storage.getAllTasks();
    res.json(tasks);
  });

  app.post("/api/tasks", async (req, res) => {
    const result = insertTaskSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.flatten() });
    const task = await storage.createTask(result.data);
    res.json(task);
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const task = await storage.updateTask(id, req.body);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteTask(id);
    res.json({ ok: true });
  });

  // ─── Sessions ───────────────────────────────────────────────
  app.get("/api/sessions/recent", async (req, res) => {
    const sessions = await storage.getRecentSessions(10);
    res.json(sessions);
  });

  app.post("/api/sessions", async (req, res) => {
    const result = insertSessionSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.flatten() });
    const session = await storage.createSession(result.data);
    res.json(session);
  });

  app.patch("/api/sessions/:id/complete", async (req, res) => {
    const id = parseInt(req.params.id);
    const { notes } = req.body;
    const session = await storage.completeSession(id, notes);
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(session);
  });

  // ─── Weekly Review ──────────────────────────────────────────
  app.get("/api/weekly-review", async (req, res) => {
    const { start, end } = req.query as { start: string; end: string };
    if (!start || !end) return res.status(400).json({ error: "start and end dates required" });
    const data = await storage.getWeeklyData(start, end);
    res.json(data);
  });

}
