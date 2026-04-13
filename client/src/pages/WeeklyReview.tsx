import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import type { Task, Session, Checkin } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, CheckCircle2, Clock, Zap, Smile,
  TrendingUp, Trophy, Star, Brain, BarChart2, CalendarDays, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDuration(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};
const CATEGORY_COLORS: Record<string, string> = {
  "job-apps": "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  consulting: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  personal: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  health: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  learning: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  general: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  admin: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

// ─── Tiny inline SVG bar chart ────────────────────────────────────────────────

function BarChart({
  data,
  height = 80,
  color = "hsl(var(--primary))",
  secondaryColor,
  secondaryData,
  yMax,
  labels,
}: {
  data: number[];
  height?: number;
  color?: string;
  secondaryColor?: string;
  secondaryData?: number[];
  yMax?: number;
  labels: string[];
}) {
  const max = yMax ?? Math.max(...data, ...(secondaryData ?? []), 1);
  const barW = 20;
  const gap = 8;
  const svgW = labels.length * (barW + gap) + (secondaryData ? labels.length * (barW + gap / 2) : 0);
  const svgH = height + 24; // extra for labels

  return (
    <svg viewBox={`0 0 ${svgW + 16} ${svgH}`} className="w-full overflow-visible" preserveAspectRatio="xMidYMid meet">
      {labels.map((label, i) => {
        const x = i * (barW + gap + (secondaryData ? barW + gap / 2 : 0)) + 8;
        const val = data[i] ?? 0;
        const barH = max > 0 ? (val / max) * height : 0;
        const secVal = secondaryData?.[i] ?? 0;
        const secBarH = max > 0 ? (secVal / max) * height : 0;

        return (
          <g key={i}>
            {/* Primary bar */}
            <rect
              x={x}
              y={height - barH}
              width={barW}
              height={barH}
              rx={3}
              fill={val > 0 ? color : "hsl(var(--border))"}
              opacity={val > 0 ? 0.85 : 0.3}
            />
            {/* Secondary bar (energy/mood) */}
            {secondaryData && (
              <rect
                x={x + barW + gap / 2}
                y={height - secBarH}
                width={barW}
                height={secBarH}
                rx={3}
                fill={secVal > 0 ? (secondaryColor ?? "hsl(var(--accent))") : "hsl(var(--border))"}
                opacity={secVal > 0 ? 0.75 : 0.3}
              />
            )}
            {/* Value label on primary bar */}
            {val > 0 && (
              <text
                x={x + barW / 2}
                y={height - barH - 3}
                textAnchor="middle"
                fontSize="9"
                fill="hsl(var(--foreground))"
                opacity={0.6}
              >
                {val}
              </text>
            )}
            {/* Day label */}
            <text
              x={secondaryData ? x + barW + gap / 2 : x + barW / 2}
              y={svgH - 4}
              textAnchor="middle"
              fontSize="9"
              fill="hsl(var(--muted-foreground))"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Sparkline (for energy/mood trend) ───────────────────────────────────────

function Sparkline({ data, color, height = 40, yMax = 5 }: { data: (number | null)[]; color: string; height?: number; yMax?: number }) {
  const w = 200;
  const step = w / (data.length - 1 || 1);
  const points = data
    .map((v, i) => v != null ? `${i * step},${height - (v / yMax) * height}` : null)
    .filter(Boolean) as string[];

  if (points.length < 2) {
    return <div className="text-xs text-muted-foreground">Not enough data</div>;
  }

  const polyline = points.join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${height + 4}`} className="w-full" preserveAspectRatio="none">
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
      {data.map((v, i) =>
        v != null ? (
          <circle
            key={i}
            cx={i * step}
            cy={height - (v / yMax) * height}
            r={3}
            fill={color}
            opacity={0.9}
          />
        ) : null
      )}
    </svg>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: any; color: string }) {
  return (
    <Card className="border-border">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", color)}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface WeeklyData {
  checkinsByDate: Checkin[];
  completedTasks: Task[];
  sessionsByDate: Session[];
}

export default function WeeklyReview() {
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(new Date()));

  const weekEnd = addDays(weekStart, 6);
  const startStr = toDateStr(weekStart);
  const endStr = toDateStr(weekEnd);

  const isCurrentWeek = toDateStr(getMondayOfWeek(new Date())) === startStr;

  const { data, isLoading } = useQuery<WeeklyData>({
    queryKey: ["/api/weekly-review", startStr, endStr],
    queryFn: () =>
      apiRequest("GET", `/api/weekly-review?start=${startStr}&end=${endStr}`).then((r) => r.json()),
  });

  const prevWeek = () => setWeekStart((w) => addDays(w, -7));
  const nextWeek = () => setWeekStart((w) => addDays(w, 7));

  // Build 7-day buckets
  const days = Array.from({ length: 7 }, (_, i) => toDateStr(addDays(weekStart, i)));

  const checkinMap = new Map<string, Checkin>();
  data?.checkinsByDate.forEach((c) => checkinMap.set(c.date, c));

  const tasksByDay = new Map<string, Task[]>();
  data?.completedTasks.forEach((t) => {
    // Handle both camelCase (TypeScript) and snake_case (raw SQLite) field names
    const completedAt = t.completedAt ?? (t as any).completed_at ?? null;
    const d = completedAt ? completedAt.split("T")[0] : "";
    if (d) {
      const existing = tasksByDay.get(d) ?? [];
      tasksByDay.set(d, [...existing, t]);
    }
  });

  const sessionsByDay = new Map<string, Session[]>();
  data?.sessionsByDate.forEach((s) => {
    const startedAt = s.startedAt ?? (s as any).started_at ?? "";
    const d = startedAt.split("T")[0];
    if (d) {
      const existing = sessionsByDay.get(d) ?? [];
      sessionsByDay.set(d, [...existing, s]);
    }
  });

  // Chart data arrays (one entry per day)
  const tasksPerDay = days.map((d) => tasksByDay.get(d)?.length ?? 0);
  const focusPerDay = days.map((d) =>
    (sessionsByDay.get(d) ?? []).reduce((sum, s) => sum + s.durationMinutes, 0)
  );
  const energyPerDay = days.map((d) => checkinMap.get(d)?.energy ?? null);
  const moodPerDay = days.map((d) => checkinMap.get(d)?.mood ?? null);

  // Totals
  const totalDone = data?.completedTasks.length ?? 0;
  const totalFocus = data?.sessionsByDate.reduce((sum, s) => sum + s.durationMinutes, 0) ?? 0;
  const totalSessions = data?.sessionsByDate.length ?? 0;
  const checkinDays = data?.checkinsByDate.length ?? 0;
  const avgEnergy = checkinDays > 0
    ? (data!.checkinsByDate.reduce((s, c) => s + c.energy, 0) / checkinDays).toFixed(1)
    : "—";
  const avgMood = checkinDays > 0
    ? (data!.checkinsByDate.reduce((s, c) => s + c.mood, 0) / checkinDays).toFixed(1)
    : "—";

  // Best day (most tasks done)
  const bestDayIdx = tasksPerDay.indexOf(Math.max(...tasksPerDay));
  const bestDay = tasksPerDay[bestDayIdx] > 0 ? DAY_LABELS[bestDayIdx] : null;

  // Tasks by category
  const catMap = new Map<string, number>();
  data?.completedTasks.forEach((t) => {
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + 1);
  });
  const catEntries = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);

  // Sorted completed tasks for the list
  const sortedDone = [...(data?.completedTasks ?? [])].sort(
    (a, b) => PRIORITY_ORDER[a.priority ?? 'medium'] - PRIORITY_ORDER[b.priority ?? 'medium']
  );

  const weekLabel = `${fmtDate(startStr)} – ${fmtDate(endStr)}`;

  // Streak: consecutive days with a check-in up to today
  const todayStr = toDateStr(new Date());
  let streakCount = 0;
  for (let i = 6; i >= 0; i--) {
    const d = toDateStr(addDays(weekStart, i));
    if (d > todayStr) continue;
    if (checkinMap.has(d)) streakCount++;
    else break;
  }

  // Gentle insight copy
  const insight = (() => {
    if (totalDone === 0 && checkinDays === 0) return "No data yet for this week. Check in daily and complete some tasks to see your patterns here.";
    if (totalDone === 0) return `You checked in ${checkinDays} day${checkinDays > 1 ? "s" : ""} this week — that consistency matters. No tasks were marked done, but showing up is progress.`;
    if (totalFocus < 30) return `You completed ${totalDone} task${totalDone > 1 ? "s" : ""} this week. Adding focused timer sessions will help you track exactly where your energy went.`;
    if (Number(avgEnergy) >= 4) return `Strong week — high energy (${avgEnergy}/5 avg) and ${totalDone} tasks done. You were firing on all cylinders.`;
    if (Number(avgEnergy) <= 2) return `It was a low-energy week (${avgEnergy}/5 avg), but you still completed ${totalDone} tasks. That's resilience.`;
    return `Solid week: ${totalDone} tasks done, ${fmtDuration(totalFocus)} of focused work, and ${checkinDays} check-in${checkinDays !== 1 ? "s" : ""}. Keep building the habit.`;
  })();

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header + week navigator */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
            Weekly Review
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevWeek} data-testid="prev-week">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {!isCurrentWeek && (
            <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => setWeekStart(getMondayOfWeek(new Date()))} data-testid="current-week">
              This week
            </Button>
          )}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextWeek} disabled={isCurrentWeek} data-testid="next-week">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 skeleton rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Insight banner */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-3">
            <Brain className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground leading-relaxed">{insight}</p>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Tasks done" value={totalDone} icon={CheckCircle2} color="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" />
            <StatCard label="Focus time" value={fmtDuration(totalFocus)} sub={`${totalSessions} sessions`} icon={Clock} color="bg-primary/10 text-primary" />
            <StatCard label="Avg energy" value={avgEnergy} sub={`${checkinDays}/7 days`} icon={Zap} color="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" />
            <StatCard label="Avg mood" value={avgMood} sub={streakCount > 0 ? `${streakCount}d streak` : undefined} icon={Smile} color="bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300" />
          </div>

          {/* Best day callout */}
          {bestDay && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg w-fit">
              <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Best day: <span className="font-bold">{bestDay}</span> — {Math.max(...tasksPerDay)} tasks completed
              </p>
            </div>
          )}

          {/* Tasks completed chart */}
          <Card className="border-border" data-testid="tasks-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Tasks completed per day
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <BarChart
                data={tasksPerDay}
                labels={DAY_LABELS}
                color="hsl(142 71% 45%)"
                height={80}
                yMax={Math.max(...tasksPerDay, 3)}
              />
              {totalDone === 0 && (
                <p className="text-xs text-center text-muted-foreground mt-2 pb-1">No tasks completed this week</p>
              )}
            </CardContent>
          </Card>

          {/* Focus time chart */}
          <Card className="border-border" data-testid="focus-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                <Clock className="w-4 h-4 text-primary" />
                Focus minutes per day
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <BarChart
                data={focusPerDay}
                labels={DAY_LABELS}
                color="hsl(var(--primary))"
                height={80}
                yMax={Math.max(...focusPerDay, 60)}
              />
              {totalFocus === 0 && (
                <p className="text-xs text-center text-muted-foreground mt-2 pb-1">No focus sessions logged this week</p>
              )}
            </CardContent>
          </Card>

          {/* Energy & Mood trend */}
          <Card className="border-border" data-testid="mood-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                <TrendingUp className="w-4 h-4 text-amber-500" />
                Energy & Mood trend
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {/* Legend */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-amber-500 inline-block rounded" />
                  Energy
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-pink-500 inline-block rounded" />
                  Mood
                </span>
                <span className="text-muted-foreground/60 ml-auto">scored 1–5</span>
              </div>

              {/* Day-by-day cards */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((d, i) => {
                  const c = checkinMap.get(d);
                  const isPast = d <= toDateStr(new Date());
                  return (
                    <div
                      key={d}
                      data-testid={`day-card-${i}`}
                      className={cn(
                        "flex flex-col items-center gap-1 p-1.5 rounded-lg border text-center",
                        c ? "bg-card border-border" : isPast ? "bg-muted/30 border-border/30" : "bg-muted/10 border-border/10"
                      )}
                    >
                      <p className="text-[9px] font-medium text-muted-foreground">{DAY_LABELS[i]}</p>
                      {c ? (
                        <>
                          <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">{c.energy}</span>
                          </div>
                          <div className="w-6 h-6 rounded-full bg-pink-100 dark:bg-pink-950 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-pink-700 dark:text-pink-300">{c.mood}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-6 h-6 rounded-full bg-border/40 flex items-center justify-center">
                            <span className="text-[9px] text-muted-foreground">—</span>
                          </div>
                          <div className="w-6 h-6 rounded-full bg-border/40 flex items-center justify-center">
                            <span className="text-[9px] text-muted-foreground">—</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Sparklines */}
              {checkinDays >= 2 && (
                <div className="space-y-2 pt-1">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Energy trend</p>
                    <Sparkline data={energyPerDay} color="hsl(38 92% 50%)" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Mood trend</p>
                    <Sparkline data={moodPerDay} color="hsl(330 60% 65%)" />
                  </div>
                </div>
              )}

              {checkinDays === 0 && (
                <p className="text-xs text-center text-muted-foreground py-2">No check-ins this week yet</p>
              )}
            </CardContent>
          </Card>

          {/* Tasks by category breakdown */}
          {catEntries.length > 0 && (
            <Card className="border-border" data-testid="category-breakdown">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                  <BarChart2 className="w-4 h-4 text-primary" />
                  Completed by category
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {catEntries.map(([cat, count]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium w-24 text-center shrink-0", CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.general)}>
                      {cat}
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${(count / totalDone) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-foreground w-6 text-right">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Completed task list */}
          <Card className="border-border" data-testid="completed-tasks-list">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                <Star className="w-4 h-4 text-amber-500" />
                Completed this week ({totalDone})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {sortedDone.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                  <p className="text-sm text-muted-foreground">
                    No tasks completed this week yet.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tip: mark tasks as "done" in the Tasks page to see them here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedDone.map((task) => (
                    <div
                      key={task.id}
                      data-testid={`done-task-${task.id}`}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg bg-green-50/60 dark:bg-green-950/20 border border-green-100 dark:border-green-900/40"
                    >
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-snug line-through decoration-muted-foreground/40">{task.title}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", PRIORITY_COLORS[task.priority])}>
                            {task.priority}
                          </span>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS.general)}>
                            {task.category}
                          </span>
                          {task.estimatedMinutes && (
                            <span className="text-[10px] text-muted-foreground">{task.estimatedMinutes}min</span>
                          )}
                          {(task.completedAt ?? (task as any).completed_at) && (
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {fmtDate((task.completedAt ?? (task as any).completed_at).split("T")[0])}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daily check-in intentions log */}
          {data && data.checkinsByDate.length > 0 && (
            <Card className="border-border" data-testid="intentions-log">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                  <CalendarDays className="w-4 h-4 text-primary" />
                  Daily intentions this week
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {data.checkinsByDate.map((c) => (
                  <div key={c.id} data-testid={`intention-${c.id}`} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/40 border border-border/50">
                    <div className="shrink-0 text-center">
                      <p className="text-[10px] font-bold text-muted-foreground">{new Date(c.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}</p>
                      <p className="text-[10px] text-muted-foreground">{fmtDate(c.date)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug">{c.intention}</p>
                      {c.gratitude && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 italic">Grateful: {c.gratitude}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <div className="flex flex-col items-center">
                        <Zap className="w-3 h-3 text-amber-500" />
                        <span className="text-[10px] font-bold text-foreground">{c.energy}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <Smile className="w-3 h-3 text-pink-500" />
                        <span className="text-[10px] font-bold text-foreground">{c.mood}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
