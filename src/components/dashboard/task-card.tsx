"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Circle,
  GripVertical,
  Pencil,
  X,
} from "lucide-react";
import type { DraggableAttributes } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types/task";
import { formatShortDate } from "@/lib/date";

type TaskCardProps = {
  task: Task;
  isCompleted: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (input: {
    title: string;
    description: string | null;
    task_date: string;
  }) => Promise<void>;
  onToggleComplete: () => Promise<void>;
  dragAttributes?: DraggableAttributes;
  dragListeners?: Record<string, unknown>;
};

export function TaskCard({
  task,
  isCompleted,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onToggleComplete,
  dragAttributes,
  dragListeners,
}: TaskCardProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [taskDate, setTaskDate] = useState(task.task_date);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setTaskDate(task.task_date);
    }
  }, [isEditing, task]);
    return (
      <motion.div
        layout
        className="rounded-xl border border-border/60 bg-card p-4 shadow-sm"
      >
        <div className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            autoFocus
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={3}
          />
          <Input
            type="date"
            value={taskDate}
            onChange={(e) => setTaskDate(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit}>
              <X className="size-4" />
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving || !title.trim()}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSave({
                    title,
                    description: description.trim() || null,
                    task_date: taskDate,
                  });
                } finally {
                  setSaving(false);
                }
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isCompleted ? 0.72 : 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={cn(
        "group flex gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
        isCompleted && "bg-muted/40",
      )}
    >
      {!isCompleted && dragAttributes && dragListeners && (
        <button
          type="button"
          className="mt-0.5 cursor-grab text-muted-foreground opacity-60 transition-opacity hover:opacity-100 active:cursor-grabbing"
          aria-label="Reorder task"
          {...dragAttributes}
          {...dragListeners}
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium leading-snug">{task.title}</p>
            {task.description ? (
              <p className="text-sm text-muted-foreground">{task.description}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Due {formatShortDate(task.task_date)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 opacity-70 hover:opacity-100"
              onClick={onStartEdit}
              aria-label="Edit task"
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 opacity-70 hover:opacity-100"
              onClick={onToggleComplete}
              aria-label={isCompleted ? "Mark pending" : "Mark complete"}
            >
              {isCompleted ? (
                <Check className="size-4 text-emerald-500" />
              ) : (
                <Circle className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
