import type { Task } from "@/lib/types/task";

const CACHE_PREFIX = "dayflow:tasks:v1:";

export function readTaskCache(userId: string): Task[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + userId);
    if (!raw) return null;
    return JSON.parse(raw) as Task[];
  } catch {
    return null;
  }
}

export function writeTaskCache(userId: string, tasks: Task[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify(tasks));
  } catch {
    /* ignore quota */
  }
}

export function exportCompletedTasksCsv(tasks: Task[]) {
  const completed = tasks.filter((t) => t.status === "completed");
  const header = [
    "id",
    "title",
    "description",
    "task_date",
    "completed_at",
    "created_at",
  ];
  const rows = completed.map((t) =>
    [
      t.id,
      escapeCsv(t.title),
      escapeCsv(t.description ?? ""),
      t.task_date,
      t.completed_at ?? "",
      t.created_at,
    ].join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

function escapeCsv(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
