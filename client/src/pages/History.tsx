import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Session, Checkin } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Calendar, TrendingUp, Brain, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ENERGY_LABELS = ["", "Drained", "Low", "Okay", "Good", "Energized"];
const MOOD_LABELS = ["", "Rough", "Low", "Neutral", "Good", "Great"];

function formatDuration(mins: number) {
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function EnergyBar({ value }: { value: number }) {
  const colors = ["", "bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-lime-400", "bg-green-400"];
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((v) => (
        <div key={v} className={cn("h-1.5 w-4 rounded-full", v <= value ? colors[value] : "bg-border")} />
      ))}
    </div>
  );
}

export default function History() {
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ["/api/sessions/recent"],
    queryFn: () => apiRequest("GET", "/api/sessions/recent").then((r) => r.json()),
  });

  const { data: checkins = [], isLoading: checkinsLoading } = useQuery<Checkin[]>({
    queryKey: ["/api/checkins/recent"],
    queryFn: () => apiRequest("GET", "/api/checkins/recent").then((r) => r.json()),
  });

  const completedSessions = sessions.filter((s) => s.completedAt && !s.interrupted);
  const totalFocusMinutes = completedSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const avgEnergy = checkins.length > 0
    ? Math.round(checkins.reduce((sum, c) => sum + c.energy, 0) / checkins.length * 10) / 10
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>History</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Your recent check-ins and focus sessions</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-primary">{completedSessions.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sessions done</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-foreground">{formatDuration(totalFocusMinutes)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total focus</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{avgEnergy ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Avg energy</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent check-ins */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <Brain className="w-4 h-4 text-primary" />
            Recent Check-ins
          </CardTitle>
        </CardHeader>
        <CardContent>
          {checkinsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 skeleton rounded-lg" />)}
            </div>
          ) : checkins.length === 0 ? (
            <div className="text-center py-6">
              <Brain className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
              <p className="text-sm text-muted-foreground">No check-ins yet. Start your day from the Dashboard.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {checkins.map((c) => (
                <div key={c.id} data-testid={`checkin-${c.id}`} className="p-3 rounded-lg bg-muted/40 border border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {c.date}
                    </p>
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Energy</p>
                        <EnergyBar value={c.energy} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Mood</p>
                        <EnergyBar value={c.mood} />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-foreground">{c.intention}</p>
                  {c.gratitude && (
                    <p className="text-xs text-muted-foreground italic">Grateful for: {c.gratitude}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent focus sessions */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <Clock className="w-4 h-4 text-primary" />
            Recent Focus Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 skeleton rounded-lg" />)}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-6">
              <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
              <p className="text-sm text-muted-foreground">No focus sessions yet. Head to the Timer to start one.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  data-testid={`session-${s.id}`}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border",
                    s.completedAt && !s.interrupted
                      ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900"
                      : "bg-muted/40 border-border/50"
                  )}
                >
                  {s.completedAt && !s.interrupted ? (
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {s.taskTitle || "Free session"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{s.durationMinutes}min focus</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{formatDate(s.startedAt)}</span>
                    </div>
                    {s.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic truncate">{s.notes}</p>
                    )}
                  </div>
                  <span className={cn(
                    "text-xs font-medium shrink-0",
                    s.completedAt && !s.interrupted ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                  )}>
                    {s.completedAt && !s.interrupted ? "Done" : "Interrupted"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trend insight */}
      {checkins.length >= 3 && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg flex items-start gap-3">
          <TrendingUp className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Pattern insight</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You've checked in {checkins.length} times recently — that consistency is a real win for someone managing executive dysfunction.
              Your avg energy is {avgEnergy}/5. On your best days, lean into that momentum.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
