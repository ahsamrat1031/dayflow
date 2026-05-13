import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { Task } from "@/lib/types/task";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("task_date", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    console.error(error);
  }

  return (
    <DashboardShell
      userId={user.id}
      initialTasks={(tasks ?? []) as Task[]}
    />
  );
}
