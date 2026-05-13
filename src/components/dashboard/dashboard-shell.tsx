"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { format, parseISO, startOfDay } from "date-fns";
import { motion } from "framer-motion";
import {
  BarChart3,
  CalendarDays,
  Flame,
  Keyboard,
  LogOut,
  Moon,
  Plus,
  Search,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  createTaskAction,
  reorderTasksAction,
  setTaskStatusAction,
  updateTaskAction,
} from "@/lib/actions/tasks";
import { exportCompletedTasksCsv, writeTaskCache } from "@/lib/cache";
import { formatHeading, toDateKey } from "@/lib/date";
import { computeStreak } from "@/lib/streak";
import type { Task, TaskFilter } from "@/lib/types/task";
import { SortableTask, type SaveTaskInput } from "@/components/dashboard/sortable-task";
import { TaskCard } from "@/components/dashboard/task-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type DashboardShellProps = {
  userId: string;
  initialTasks: Task[];
};

function applyFilter(tasks: Task[], filter: TaskFilter, todayKey: string) {
  switch (filter) {
    case "today":
      return tasks.filter((t) => t.task_date === todayKey);
    case "upcoming":
      return tasks.filter((t) => t.task_date > todayKey);
    case "completed":
      return tasks.filter((t) => t.status === "completed");
    default:
      return tasks;
  }
}

function applySearch(tasks: Task[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return tasks;
  return tasks.filter((t) => {
    const hay = `${t.title} ${t.description ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
}

function groupByDate(tasks: Task[]) {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    const list = map.get(t.task_date) ?? [];
    list.push(t);
    map.set(t.task_date, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, list]) => [
      k,
      [...list].sort((a, b) => a.sort_order - b.sort_order),
    ]) as [string, Task[]][];
}

function completionDates(tasks: Task[]) {
  return tasks
    .filter((t) => t.status === "completed")
    .map((t) =>
      t.completed_at
        ? format(parseISO(t.completed_at), "yyyy-MM-dd")
        : t.task_date,
    );
}

export function DashboardShell({ userId, initialTasks }: DashboardShellProps) {
  const router = useRouter();
  const supabase = createClient();
  const { resolvedTheme, setTheme } = useTheme();

  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const todayKey = useMemo(() => toDateKey(startOfDay(new Date())), []);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    writeTaskCache(userId, tasks);
  }, [tasks, userId]);

  useEffect(() => {
    const channel = supabase
      .channel(`tasks:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setTasks((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((t) => t.id !== (payload.old as Task).id);
            }
            const row = payload.new as Task;
            const exists = prev.some((t) => t.id === row.id);
            if (exists) {
              return prev.map((t) => (t.id === row.id ? row : t));
            }
            return [...prev, row].sort((a, b) => {
              const d = a.task_date.localeCompare(b.task_date);
              if (d !== 0) return d;
              return a.sort_order - b.sort_order;
            });
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    };

    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (
        e.key.toLowerCase() === "n" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault();
        titleRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const base = applyFilter(tasks, filter, todayKey);
    return applySearch(base, search);
  }, [tasks, filter, search, todayKey]);

  const pendingGrouped = useMemo(() => {
    const pending = filtered.filter((t) => t.status === "pending");
    return groupByDate(pending);
  }, [filtered]);

  const completedGrouped = useMemo(() => {
    const completed = filtered.filter((t) => t.status === "completed");
    return groupByDate(completed).map(([k, list]) => [
      k,
      [...list].sort(
        (a, b) =>
          new Date(b.completed_at ?? b.updated_at).getTime() -
          new Date(a.completed_at ?? a.updated_at).getTime(),
      ),
    ]) as [string, Task[]][];
  }, [filtered]);

  const streak = useMemo(() => computeStreak(completionDates(tasks)), [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleAdd = async () => {
    if (!title.trim()) {
      toast.error("Add a title first.");
      return;
    }
    setAdding(true);
    const dateKey = toDateKey(selectedDate);
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: Task = {
      id: tempId,
      user_id: userId,
      title: title.trim(),
      description: description.trim() || null,
      task_date: dateKey,
      status: "pending",
      sort_order:
        tasks.filter((t) => t.task_date === dateKey && t.status === "pending")
          .length,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setTasks((prev) => [...prev, optimistic]);
    setTitle("");
    setDescription("");

    try {
      const created = await createTaskAction({
        title: optimistic.title,
        description: optimistic.description,
        task_date: dateKey,
      });
      setTasks((prev) =>
        prev
          .map((t) => (t.id === tempId ? created : t))
          .sort((a, b) => {
            const d = a.task_date.localeCompare(b.task_date);
            if (d !== 0) return d;
            return a.sort_order - b.sort_order;
          }),
      );
      toast.success("Task added");
      router.refresh();
    } catch (err) {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      toast.error(err instanceof Error ? err.message : "Could not add task");
    } finally {
      setAdding(false);
    }
  };

  const handleSave = async (task: Task, input: SaveTaskInput) => {
    const prev = tasks;
    setTasks((cur) =>
      cur.map((t) =>
        t.id === task.id
          ? { ...t, ...input, updated_at: new Date().toISOString() }
          : t,
      ),
    );
    try {
      const updated = await updateTaskAction({
        id: task.id,
        title: input.title,
        description: input.description,
        task_date: input.task_date,
      });
      setTasks((cur) => cur.map((t) => (t.id === updated.id ? updated : t)));
      toast.success("Task updated");
      router.refresh();
    } catch (err) {
      setTasks(prev);
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleToggleComplete = async (task: Task) => {
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    const prev = tasks;
    setTasks((cur) =>
      cur.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: nextStatus,
              completed_at:
                nextStatus === "completed"
                  ? new Date().toISOString()
                  : null,
              updated_at: new Date().toISOString(),
            }
          : t,
      ),
    );
    try {
      const updated = await setTaskStatusAction({
        id: task.id,
        status: nextStatus,
      });
      setTasks((cur) => cur.map((t) => (t.id === updated.id ? updated : t)));
      toast.success(
        nextStatus === "completed" ? "Marked complete" : "Moved to pending",
      );
      router.refresh();
    } catch (err) {
      setTasks(prev);
      toast.error(err instanceof Error ? err.message : "Could not update");
    }
  };

  const handleDragEnd = useCallback(
    async (dateKey: string, event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const visiblePending = filtered
        .filter((t) => t.task_date === dateKey && t.status === "pending")
        .sort((a, b) => a.sort_order - b.sort_order);

      const oldIndex = visiblePending.findIndex((t) => t.id === active.id);
      const newIndex = visiblePending.findIndex((t) => t.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      const reordered = arrayMove(visiblePending, oldIndex, newIndex);
      const updates = reordered.map((t, idx) => ({ id: t.id, sort_order: idx }));

      const prev = tasks;
      setTasks((cur) => {
        const map = new Map(reordered.map((t, i) => [t.id, i]));
        return cur.map((t) =>
          map.has(t.id) ? { ...t, sort_order: map.get(t.id)! } : t,
        );
      });

      try {
        await reorderTasksAction(updates);
        router.refresh();
      } catch (err) {
        setTasks(prev);
        toast.error(err instanceof Error ? err.message : "Reorder failed");
      }
    },
    [filtered, tasks, router],
  );

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const exportCsv = () => {
    const csv = exportCompletedTasksCsv(tasks);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dayflow-completed-${todayKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported completed tasks");
  };

  const analytics = useMemo(() => {
    const completed = tasks.filter((t) => t.status === "completed");
    const pending = tasks.filter((t) => t.status === "pending");
    const last7 = Array.from({ length: 7 }).map((_, i) => {
      const d = startOfDay(new Date());
      d.setDate(d.getDate() - (6 - i));
      const key = toDateKey(d);
      const count = completed.filter(
        (t) =>
          (t.completed_at
            ? format(parseISO(t.completed_at), "yyyy-MM-dd")
            : t.task_date) === key,
      ).length;
      return { key, count };
    });
    const rate =
      completed.length + pending.length === 0
        ? 0
        : Math.round(
            (completed.length / (completed.length + pending.length)) * 100,
          );
    return { completed: completed.length, pending: pending.length, last7, rate };
  }, [tasks]);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-muted/25">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
              D
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">Dayflow</p>
              <p className="text-xs text-muted-foreground">Daily calm focus</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden gap-1 sm:inline-flex">
              <Flame className="size-3 text-orange-500" />
              {streak} day streak
            </Badge>
            <Button
              variant="outline"
              size="icon"
              className="relative rounded-full"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              aria-label="Toggle theme"
            >
              <Sun className="size-4 scale-100 transition-all dark:scale-0" />
              <Moon className="absolute size-4 scale-0 transition-all dark:scale-100" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full">
                  Menu
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Workspace</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setAnalyticsOpen(true)}>
                  <BarChart3 className="size-4" />
                  Insights
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportCsv}>
                  Export completed (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
                  <Keyboard className="size-4" />
                  Keyboard shortcuts
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
        <section className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Today
          </p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {format(selectedDate, "EEEE, MMMM d")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {format(selectedDate, "yyyy")} · Focus on what matters today.
              </p>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 rounded-full">
                  <CalendarDays className="size-4" />
                  Pick date
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(startOfDay(d))}
                />
              </PopoverContent>
            </Popover>
          </div>
        </section>

        <section className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="rounded-full pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All"],
                ["today", "Today"],
                ["upcoming", "Upcoming"],
                ["completed", "Completed"],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={filter === key ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setFilter(key)}
              >
                {label}
              </Button>
            ))}
            <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
              ⌘K search · / search · N new task
            </span>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm backdrop-blur-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">New task</h2>
              <p className="text-sm text-muted-foreground">
                Captured for {format(selectedDate, "MMM d")}.
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1 rounded-full"
              onClick={() => void handleAdd()}
              disabled={adding}
            >
              <Plus className="size-4" />
              Add
            </Button>
          </div>
          <div className="space-y-3">
            <Input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs your attention?"
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional context, links, or notes"
              rows={3}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Pending</h2>
            <span className="text-xs text-muted-foreground">
              {pendingGrouped.reduce((acc, [, list]) => acc + list.length, 0)}{" "}
              open
            </span>
          </div>
          {pendingGrouped.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
              Nothing pending here. Add a task or widen your filters.
            </div>
          ) : (
            pendingGrouped.map(([dateKey, list]) => (
              <div key={dateKey} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Separator className="flex-1" />
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {formatHeading(dateKey)}
                  </p>
                  <Separator className="flex-1" />
                </div>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => void handleDragEnd(dateKey, e)}
                >
                  <SortableContext
                    items={list.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {list.map((task) => (
                        <motion.div
                          key={task.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 30,
                          }}
                        >
                          <SortableTask
                            task={task}
                            editingId={editingId}
                            setEditingId={setEditingId}
                            onSave={handleSave}
                            onToggleComplete={handleToggleComplete}
                          />
                        </motion.div>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            ))
          )}
        </section>

        <section className="space-y-4 pb-16">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Completed</h2>
            <span className="text-xs text-muted-foreground">
              {completedGrouped.reduce((acc, [, list]) => acc + list.length, 0)}{" "}
              done
            </span>
          </div>
          {completedGrouped.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/10 px-6 py-12 text-center text-sm text-muted-foreground">
              Completed work appears here — nothing to celebrate yet.
            </div>
          ) : (
            completedGrouped.map(([dateKey, list]) => (
              <div key={dateKey} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Separator className="flex-1" />
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {formatHeading(dateKey)}
                  </p>
                  <Separator className="flex-1" />
                </div>
                <div className="space-y-3">
                  {list.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isCompleted
                      isEditing={editingId === task.id}
                      onStartEdit={() => setEditingId(task.id)}
                      onCancelEdit={() => setEditingId(null)}
                      onSave={async (input) => {
                        await handleSave(task, input);
                        setEditingId(null);
                      }}
                      onToggleComplete={() => handleToggleComplete(task)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      <Dialog open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insights</DialogTitle>
            <DialogDescription>
              Lightweight analytics for your rhythm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-2xl font-semibold">{analytics.completed}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-2xl font-semibold">{analytics.pending}</p>
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Completion mix</p>
              <p className="text-lg font-semibold">{analytics.rate}%</p>
              <p className="text-xs text-muted-foreground">
                Completed vs total tasks in your workspace.
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Last 7 days
              </p>
              <div className="flex items-end gap-2">
                {analytics.last7.map((d) => (
                  <div key={d.key} className="flex-1 space-y-1 text-center">
                    <div
                      className="mx-auto w-full max-w-[36px] rounded-md bg-primary/80"
                      style={{
                        height: `${12 + Math.min(d.count, 8) * 10}px`,
                      }}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {format(parseISO(d.key), "EEE")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>
              Stay in flow without reaching for the mouse.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between gap-4">
              <span className="text-muted-foreground">Focus search</span>
              <span className="font-mono text-xs">⌘K / Ctrl+K</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-muted-foreground">Focus search</span>
              <span className="font-mono text-xs">/</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-muted-foreground">New task title</span>
              <span className="font-mono text-xs">N</span>
            </li>
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
