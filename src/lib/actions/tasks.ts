"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Task, TaskStatus } from "@/lib/types/task";

export async function createTaskAction(input: {
  title: string;
  description?: string | null;
  task_date: string;
}): Promise<Task> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: maxRow } = await supabase
    .from("tasks")
    .select("sort_order")
    .eq("user_id", user.id)
    .eq("task_date", input.task_date)
    .eq("status", "pending")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      task_date: input.task_date,
      status: "pending",
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/dashboard");
  return data as Task;
}

export async function updateTaskAction(input: {
  id: string;
  title: string;
  description?: string | null;
  task_date: string;
}): Promise<Task> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("tasks")
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      task_date: input.task_date,
    })
    .eq("id", input.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/dashboard");
  return data as Task;
}

export async function setTaskStatusAction(input: {
  id: string;
  status: TaskStatus;
}): Promise<Task> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("tasks")
    .update({ status: input.status })
    .eq("id", input.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/dashboard");
  return data as Task;
}

export async function reorderTasksAction(
  updates: { id: string; sort_order: number }[],
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  for (const u of updates) {
    const { error } = await supabase
      .from("tasks")
      .update({ sort_order: u.sort_order })
      .eq("id", u.id)
      .eq("user_id", user.id);
    if (error) throw error;
  }

  revalidatePath("/dashboard");
}
