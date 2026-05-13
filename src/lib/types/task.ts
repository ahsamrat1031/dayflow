export type TaskStatus = "pending" | "completed";

export type Task = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  task_date: string;
  status: TaskStatus;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskFilter = "all" | "today" | "upcoming" | "completed";
