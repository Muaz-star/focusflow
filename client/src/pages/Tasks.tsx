import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import type { Task } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, CheckCircle2, Circle, Clock, Trash2, PauseCircle, RefreshCw, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = ["general", "job-apps", "consulting", "personal", "health", "learning", "admin"];
const PRIORITIES = ["low", "medium", "high", "urgent"];
const STATUSES = ["todo", "in-progress", "done", "parked"];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "priority-urgent", high: "priority-high", medium: "priority-medium", low: "priority-low"
};
const STATUS_COLORS: Record<string, string> = {
  todo: "status-todo", "in-progress": "status-in-progress", done: "status-done", parked: "status-parked"
};

const STATUS_GROUPS = [
  { label: "To Do", key: "todo", icon: Circle },
  { label: "In Progress", key: "in-progress", icon: RefreshCw },
  { label: "Done", key: "done", icon: CheckCircle2 },
  { label: "Parked", key: "parked", icon: PauseCircle },
];

function TaskCard({ task, onUpdate, onDelete }: { task: Task; onUpdate: (id: number, data: Partial<Task>) => void; onDelete: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);

  const nextStatus: Record<string, string> = {
    todo: "in-progress", "in-progress": "done", done: "todo", parked: "todo"
  };

  return (
    <div
      data-testid={`task-item-${task.id}`}
      className="group p-3 rounded-lg border border-border bg-card hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-2.5">
        <button
          data-testid={`task-status-btn-${task.id}`}
          onClick={() => onUpdate(task.id, { status: nextStatus[task.status] })}
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
        >
          {task.status === "done" ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : task.status === "in-progress" ? (
            <RefreshCw className="w-4 h-4 text-purple-500" />
          ) : task.status === "parked" ? (
            <PauseCircle className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Circle className="w-4 h-4" />
          )}
        </button>

        <div className="flex-1 min-w-0" onClick={() => setExpanded((v) => !v)}>
          <p className={cn(
            "text-sm font-medium leading-snug cursor-pointer",
            task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"
          )}>
            {task.title}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", PRIORITY_COLORS[task.priority])}>
              {task.priority}
            </span>
            <span className="text-xs text-muted-foreground capitalize">{task.category}</span>
            {task.estimatedMinutes && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <Clock className="w-3 h-3" />{task.estimatedMinutes}m
              </span>
            )}
            {task.dueDate && (
              <span className="text-xs text-muted-foreground">due {task.dueDate}</span>
            )}
          </div>
          {expanded && task.notes && (
            <p className="text-xs text-muted-foreground mt-2 bg-muted/60 rounded p-2">{task.notes}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Select
            value={task.status}
            onValueChange={(v) => onUpdate(task.id, { status: v })}
          >
            <SelectTrigger className="h-7 w-[7rem] text-xs" data-testid={`task-status-select-${task.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            data-testid={`task-delete-${task.id}`}
            onClick={() => onDelete(task.id)}
            className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Tasks() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  // New task form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");
  const [estimatedMinutes, setEstimatedMinutes] = useState("25");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    queryFn: () => apiRequest("GET", "/api/tasks").then((r) => r.json()),
  });

  const addTask = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/tasks", data).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task added", description: "Remember: break it into smaller pieces if it feels big." });
      setTitle(""); setCategory("general"); setPriority("medium");
      setEstimatedMinutes("25"); setNotes(""); setDueDate("");
      setShowAdd(false);
    },
  });

  const updateTask = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Task> }) =>
      apiRequest("PATCH", `/api/tasks/${id}`, data).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  const deleteTask = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tasks/${id}`).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task removed" });
    },
  });

  const handleAddTask = () => {
    if (!title.trim()) {
      toast({ title: "Add a title", variant: "destructive" });
      return;
    }
    addTask.mutate({
      title: title.trim(), category, priority,
      estimatedMinutes: parseInt(estimatedMinutes) || 25,
      notes: notes || null, dueDate: dueDate || null, status: "todo", order: tasks.length
    });
  };

  const filteredTasks = filter === "all" ? tasks : tasks.filter((t) => t.status === filter || t.priority === filter || t.category === filter);

  const grouped = STATUS_GROUPS.map((g) => ({
    ...g,
    tasks: filteredTasks.filter((t) => t.status === g.key),
  })).filter((g) => g.tasks.length > 0 || g.key === "todo");

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Tasks</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Break big tasks into 5–25 minute chunks</p>
        </div>
        <Button
          data-testid="add-task-btn"
          size="sm"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </Button>
      </div>

      {/* Quick filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", "todo", "in-progress", "urgent", "job-apps"].map((f) => (
          <button
            key={f}
            data-testid={`filter-${f}`}
            onClick={() => setFilter(f)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-all",
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
            )}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {/* Tip card */}
      <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Tip:</span> If a task feels overwhelming, click it to add notes and break it into sub-steps. Aim for 5–25 minute chunks.
        </p>
      </div>

      {/* Task groups */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 skeleton rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ label, key, icon: Icon, tasks: groupTasks }) => (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn("w-4 h-4", key === "done" ? "text-green-500" : key === "in-progress" ? "text-purple-500" : "text-muted-foreground")} />
                <h2 className="text-sm font-semibold text-foreground">{label}</h2>
                <span className="text-xs text-muted-foreground">({groupTasks.length})</span>
              </div>
              <div className="space-y-2">
                {groupTasks.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground opacity-60">
                    No tasks here yet
                  </div>
                ) : (
                  groupTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onUpdate={(id, data) => updateTask.mutate({ id, data })}
                      onDelete={(id) => deleteTask.mutate(id)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add task dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)" }}>Add a task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Task title</label>
              <Input
                data-testid="task-title-input"
                placeholder="What needs to get done?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger data-testid="task-category-select" className="text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger data-testid="task-priority-select" className="text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p} className="text-sm capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Est. minutes</label>
                <Input
                  data-testid="task-duration-input"
                  type="number"
                  min="5"
                  max="120"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Due date</label>
                <Input
                  data-testid="task-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
              <Textarea
                data-testid="task-notes-input"
                placeholder="Break it down — what's the first tiny step?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>
            <Button
              data-testid="submit-task-btn"
              onClick={handleAddTask}
              disabled={addTask.isPending}
              className="w-full"
            >
              {addTask.isPending ? "Adding..." : "Add task"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
