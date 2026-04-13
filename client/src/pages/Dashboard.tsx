import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import type { Checkin, Task } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Zap, Smile, Target, Leaf, CheckCircle2, ArrowRight, Brain, Timer, Star
} from "lucide-react";
import { cn } from "@/lib/utils";

const ENERGY_LABELS = ["", "Drained", "Low", "Okay", "Good", "Energized"];
const MOOD_LABELS = ["", "Rough", "Low", "Neutral", "Good", "Great"];

const ENERGY_COLORS = [
  "", "bg-red-200 text-red-800", "bg-orange-200 text-orange-800",
  "bg-yellow-200 text-yellow-800", "bg-lime-200 text-lime-800", "bg-green-200 text-green-800"
];

const AFFIRMATIONS = [
  "Every small step counts. You're building momentum.",
  "Your brain works differently — that's a strength, not a flaw.",
  "One task at a time. You've got this.",
  "Progress over perfection, always.",
  "It's okay to start small. Starting is the hardest part.",
  "Rest is productive. Your brain needs recovery to focus.",
  "You're showing up. That matters.",
];

function EnergyPicker({ value, onChange, labels, colors, icon: Icon, label }: any) {
  return (
    <div>
      <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
        <Icon className="w-4 h-4 text-muted-foreground" />
        {label}
      </p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            data-testid={`${label.toLowerCase()}-${v}`}
            onClick={() => onChange(v)}
            className={cn(
              "w-10 h-10 rounded-full border-2 text-sm font-bold transition-all",
              value === v
                ? `${colors[v]} border-current scale-110 shadow-md`
                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
            )}
          >
            {v}
          </button>
        ))}
      </div>
      {value > 0 && (
        <p className="text-xs text-muted-foreground mt-1 ml-1">{labels[value]}</p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [energy, setEnergy] = useState(0);
  const [mood, setMood] = useState(0);
  const [intention, setIntention] = useState("");
  const [gratitude, setGratitude] = useState("");
  const [showCheckinForm, setShowCheckinForm] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const affirmation = AFFIRMATIONS[new Date().getDay() % AFFIRMATIONS.length];

  const { data: checkin, isLoading: checkinLoading } = useQuery<Checkin | null>({
    queryKey: ["/api/checkin/today"],
    queryFn: () => apiRequest("GET", "/api/checkin/today").then((r) => r.json()),
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    queryFn: () => apiRequest("GET", "/api/tasks").then((r) => r.json()),
  });

  const submitCheckin = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/checkin", data).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/checkin/today"] });
      toast({ title: "Check-in saved", description: "Have a focused day!" });
      setShowCheckinForm(false);
    },
  });

  const handleSubmitCheckin = () => {
    if (!energy || !mood || !intention.trim()) {
      toast({ title: "Almost there", description: "Please fill in energy, mood, and your intention.", variant: "destructive" });
      return;
    }
    submitCheckin.mutate({ date: today, energy, mood, intention, gratitude: gratitude || null });
  };

  const todayTasks = tasks.filter((t) => t.status !== "done" && t.status !== "parked");
  const doneTasks = tasks.filter((t) => t.status === "done");
  const topTasks = todayTasks.slice(0, 3);

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
          {greeting}, Muhammad
        </h1>
        <p className="text-sm text-muted-foreground italic">"{affirmation}"</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-primary">{todayTasks.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{todayTasks.length === 1 ? "Active task" : "Active tasks"}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{doneTasks.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Completed</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {checkin ? ENERGY_LABELS[checkin.energy] : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Energy today</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily check-in */}
      {!checkinLoading && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
              <Brain className="w-4 h-4 text-primary" />
              Daily Check-in
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkin && !showCheckinForm ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <Target className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Today's intention</p>
                    <p className="text-sm font-medium text-foreground">{checkin.intention}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Zap className="w-3.5 h-3.5" />
                    Energy: <span className="font-medium text-foreground">{ENERGY_LABELS[checkin.energy]}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Smile className="w-3.5 h-3.5" />
                    Mood: <span className="font-medium text-foreground">{MOOD_LABELS[checkin.mood]}</span>
                  </div>
                </div>
                {checkin.gratitude && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Leaf className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-500" />
                    Grounded by: <span className="text-foreground italic">{checkin.gratitude}</span>
                  </div>
                )}
                <button
                  onClick={() => setShowCheckinForm(true)}
                  className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors"
                >
                  Update check-in
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <EnergyPicker
                    value={energy || (checkin?.energy ?? 0)}
                    onChange={(v: number) => setEnergy(v)}
                    labels={ENERGY_LABELS}
                    colors={ENERGY_COLORS}
                    icon={Zap}
                    label="Energy"
                  />
                  <EnergyPicker
                    value={mood || (checkin?.mood ?? 0)}
                    onChange={(v: number) => setMood(v)}
                    labels={MOOD_LABELS}
                    colors={ENERGY_COLORS}
                    icon={Smile}
                    label="Mood"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5 mb-2">
                    <Target className="w-4 h-4 text-muted-foreground" />
                    What's your one big intention today?
                  </label>
                  <Textarea
                    data-testid="intention-input"
                    placeholder="e.g. Finish the First Embrace simulation task and review Camber materials"
                    value={intention}
                    onChange={(e) => setIntention(e.target.value)}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5 mb-2">
                    <Leaf className="w-4 h-4 text-muted-foreground" />
                    One thing you're grateful for (optional)
                  </label>
                  <Textarea
                    data-testid="gratitude-input"
                    placeholder="Something grounding you today..."
                    value={gratitude}
                    onChange={(e) => setGratitude(e.target.value)}
                    rows={1}
                    className="text-sm resize-none"
                  />
                </div>

                <Button
                  data-testid="submit-checkin"
                  onClick={handleSubmitCheckin}
                  disabled={submitCheckin.isPending}
                  className="w-full"
                >
                  {submitCheckin.isPending ? "Saving..." : checkin ? "Update check-in" : "Start my day"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Today's focus — top 3 tasks */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
              <Star className="w-4 h-4 text-amber-500" />
              Today's Top 3
            </CardTitle>
            <Link href="/tasks">
              <a className="text-xs text-primary hover:underline flex items-center gap-1">
                All tasks <ArrowRight className="w-3 h-3" />
              </a>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {topTasks.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">No active tasks — great work or add some!</p>
              <Link href="/tasks">
                <a className="mt-2 inline-block text-xs text-primary hover:underline">Add a task</a>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {topTasks.map((task) => (
                <div
                  key={task.id}
                  data-testid={`task-card-${task.id}`}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted transition-colors"
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full mt-1.5 shrink-0",
                    task.priority === "urgent" ? "bg-red-500" :
                    task.priority === "high" ? "bg-orange-500" :
                    task.priority === "medium" ? "bg-blue-500" : "bg-gray-400"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{task.estimatedMinutes}min</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground capitalize">{task.category}</span>
                    </div>
                  </div>
                  <Link href="/timer">
                    <a className="shrink-0 p-1.5 rounded-md hover:bg-primary hover:text-primary-foreground text-muted-foreground transition-all">
                      <Timer className="w-3.5 h-3.5" />
                    </a>
                  </Link>
                </div>
              ))}
              {todayTasks.length > 3 && (
                <p className="text-xs text-center text-muted-foreground pt-1">
                  +{todayTasks.length - 3} more tasks. Parked to stay focused.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick start timer CTA */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground text-sm" style={{ fontFamily: "var(--font-display)" }}>
                Ready to focus?
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Start a 25-min Pomodoro session</p>
            </div>
            <Link href="/timer">
              <Button data-testid="start-timer-cta" size="sm" className="flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5" />
                Let's go
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
