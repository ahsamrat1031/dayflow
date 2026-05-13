"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskCard } from "@/components/dashboard/task-card";
import type { Task } from "@/lib/types/task";
import { cn } from "@/lib/utils";

export type SaveTaskInput = {
  title: string;
  description: string | null;
  task_date: string;
};

type SortableTaskProps = {
  task: Task;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onSave: (task: Task, input: SaveTaskInput) => Promise<void>;
  onToggleComplete: (task: Task) => Promise<void>;
};

export function SortableTask({
  task,
  editingId,
  setEditingId,
  onSave,
  onToggleComplete,
}: SortableTaskProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "z-10")}>
      <TaskCard
        task={task}
        isCompleted={false}
        isEditing={editingId === task.id}
        onStartEdit={() => setEditingId(task.id)}
        onCancelEdit={() => setEditingId(null)}
        onSave={async (input) => {
          await onSave(task, input);
          setEditingId(null);
        }}
        onToggleComplete={() => onToggleComplete(task)}
        dragAttributes={attributes}
        dragListeners={listeners as Record<string, unknown>}
      />
    </div>
  );
}
