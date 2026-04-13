import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Task, Session } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Play, Pause, RotateCcw, Coffee, CheckCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type Phase = "idle" | "focus" | "break" | "done";

const QUOTES = [
  "Stay with it. You're doing great.",
  "One breath at a time. One task at a time.",
  "The hardest part is already done — you started.",
  "Your future self will thank you for this.",
  "Focus is a muscle. You're training it right now.",
  "Distraction is normal. Just come back.",
];

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// SVG ring timer
function TimerRing({ progress, phase, children }: { progress: number; phase: Phase; children: React.ReactNode }) {
  const r = 90;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);

  const colors: Record<Phase, string> = {
    idle: "hsl(var(--border))",
    focus: "hsl(var(--primary))",
    break: "hsl(150 40% 50%)",
    done: "hsl(150 40% 50%)",
  };

  return (
    <div className="relative w-52 h-52 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
        <circle
          cx="100" cy="100" r={r}
          fill="none"
          stroke={colors[phase]}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

export default function Timer() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [focusMins, setFocusMins] = useState(25);
  const [breakMins, setBreakMins] = useState(5);
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("none");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionNotes, setSessionNotes] = useState("");
  const [completedCount, setCompletedCount] = useState(0);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    queryFn: () => apiRequest("GET", "/api/tasks").then((r) => r.json()),
  });

  const createSession = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sessions", data).then((r) => r.json()),
    onSuccess: (s: Session) => setSessionId(s.id),
  });

  const completeSession = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      apiRequest("PATCH", `/api/sessions/${id}/complete`, { notes }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/sessions/recent"] }),
  });

  const totalSeconds = phase === "break" ? breakMins * 60 : focusMins * 60;
  const progress = phase === "idle" ? 0 : seconds / totalSeconds;

  const activeTasks = tasks.filter((t) => t.status !== "done");
  const selectedTask = activeTasks.find((t) => t.id === parseInt(selectedTaskId));

  const stopTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
  }, []);

  const handlePhaseEnd = useCallback(() => {
    stopTimer();
    if (phase === "focus") {
      setCompletedCount((c) => c + 1);
      if (sessionId) completeSession.mutate({ id: sessionId, notes: sessionNotes });
      setSessionId(null);
      toast({
        title: "Focus session complete!",
        description: "Well done. Take a break — you earned it.",
      });
      setPhase("break");
      setSeconds(breakMins * 60);
    } else if (phase === "break") {
      toast({ title: "Break's over", description: "Ready for the next round?" });
      setPhase("idle");
      setSeconds(focusMins * 60);
    }
  }, [phase, sessionId, sessionNotes, breakMins, focusMins, stopTimer]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s <= 1) { handlePhaseEnd(); return 0; }
          return s - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, handlePhaseEnd]);

  // Rotate quote every 2 minutes during focus
  useEffect(() => {
    if (phase !== "focus" || !running) return;
    const q = setInterval(() => setQuoteIndex((i) => (i + 1) % QUOTES.length), 120000);
    return () => clearInterval(q);
  }, [phase, running]);

  const handleStart = () => {
    const taskTitle = selectedTask?.title;
    const taskId = selectedTask?.id;
    createSession.mutate({
      taskId: taskId || null, taskTitle: taskTitle || null,
      durationMinutes: focusMins, breakMinutes: breakMins
    });
    setPhase("focus");
    setSeconds(focusMins * 60);
    setRunning(true);
    setQuoteIndex(Math.floor(Math.random() * QUOTES.length));
  };

  const handlePause = () => setRunning((r) => !r);

  const handleReset = () => {
    stopTimer();
    setPhase("idle");
    setSeconds(focusMins * 60);
    setSessionId(null);
  };

  const handleStartBreak = () => {
    setPhase("break");
    setSeconds(breakMins * 60);
    setRunning(true);
  };

  const handleSkipBreak = () => {
    setPhase("idle");
    setSeconds(focusMins * 60);
    setRunning(false);
  };

  const phaseLabel = phase === "idle" ? "Ready to focus" : phase === "focus" ? "Stay focused" : phase === "break" ? "Take a break" : "Done";
  const phaseColor = phase === "break" ? "text-green-600 dark:text-green-400" : "text-primary";

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Focus Timer</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Pomodoro-style sessions with built-in breaks</p>
      </div>

      {/* Completed sessions pill */}
      {completedCount > 0 && (
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            {completedCount} session{completedCount > 1 ? "s" : ""} completed today
          </div>
        </div>
      )}

      {/* Timer ring */}
      <TimerRing progress={progress} phase={phase}>
        <p className={cn("text-4xl font-bold tabular-nums", phaseColor)} style={{ fontFamily: "var(--font-display)" }} data-testid="timer-display">
          {formatTime(seconds)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{phaseLabel}</p>
        {phase === "focus" && (
          <p className="text-xs text-primary/70 mt-0.5 text-center px-4 leading-tight">
            {QUOTES[quoteIndex]}
          </p>
        )}
        {phase === "break" && (
          <div className="flex flex-col items-center gap-1 mt-2">
            <Coffee className="w-5 h-5 text-green-500" />
            <p className="text-xs text-muted-foreground">Rest your eyes</p>
          </div>
        )}
      </TimerRing>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {(phase === "idle" || phase === "break") && phase !== "break" && (
          <Button
            data-testid="start-btn"
            onClick={handleStart}
            size="lg"
            className="px-8 gap-2"
            disabled={createSession.isPending}
          >
            <Play className="w-4 h-4" />
            Start Focus
          </Button>
        )}

        {phase === "focus" && (
          <>
            <Button
              data-testid="pause-btn"
              onClick={handlePause}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {running ? "Pause" : "Resume"}
            </Button>
            <Button
              data-testid="reset-btn"
              onClick={handleReset}
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </>
        )}

        {phase === "break" && (
          <>
            <Button
              data-testid="start-break-btn"
              onClick={handleStartBreak}
              size="lg"
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <Coffee className="w-4 h-4" />
              Start Break
            </Button>
            <Button
              data-testid="skip-break-btn"
              onClick={handleSkipBreak}
              variant="outline"
              size="sm"
            >
              Skip break
            </Button>
          </>
        )}
      </div>

      {/* Settings — only when idle */}
      {phase === "idle" && (
        <Card className="border-border">
          <CardContent className="pt-5 space-y-4">
            {/* Task selection */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">What are you working on?</label>
              <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                <SelectTrigger data-testid="task-select" className="text-sm">
                  <SelectValue placeholder="Select a task (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Free session (no task)</SelectItem>
                  {activeTasks.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)} className="text-sm">
                      {t.title.length > 40 ? t.title.slice(0, 40) + "…" : t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Focus duration */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  Focus: <span className="text-primary">{focusMins} min</span>
                </label>
              </div>
              <Slider
                data-testid="focus-slider"
                value={[focusMins]}
                onValueChange={([v]) => { setFocusMins(v); setSeconds(v * 60); }}
                min={5} max={60} step={5}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>5m</span><span>15m</span><span>25m</span><span>45m</span><span>60m</span>
              </div>
            </div>

            {/* Break duration */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5 text-green-500" />
                  Break: <span className="text-green-600 dark:text-green-400">{breakMins} min</span>
                </label>
              </div>
              <Slider
                data-testid="break-slider"
                value={[breakMins]}
                onValueChange={([v]) => setBreakMins(v)}
                min={1} max={15} step={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1m</span><span>5m</span><span>10m</span><span>15m</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session notes — during or after focus */}
      {phase === "focus" && (
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Session notes (saved on completion)</label>
          <Textarea
            data-testid="session-notes"
            placeholder="Jot thoughts, wins, or blockers as you go..."
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            rows={2}
            className="text-sm resize-none"
          />
        </div>
      )}

      {/* ADHD tips */}
      <div className="p-3 bg-muted/60 rounded-lg border border-border">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Struggling to start?</span> Try the "just 2 minutes" rule — commit to working for only 2 minutes. You can stop after. Most of the time, you'll keep going.
        </p>
      </div>
    </div>
  );
}
