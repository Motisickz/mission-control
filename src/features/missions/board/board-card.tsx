import { CalendarClock, ListChecks, MessageSquareText } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Edit3 } from "lucide-react";
import { useEffect, useState } from "react";

import type { BoardProfileDoc, BoardTaskDoc } from "./board-types";
import { formatBoardDate, getTagChipStyle, profileInitials, taskAssigneeIds } from "./board-types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

type BoardCardProps = {
  task: BoardTaskDoc;
  profileById: Map<Id<"profiles">, BoardProfileDoc>;
  onOpen: (taskId: Id<"tasks">) => void;
  onRename: (taskId: Id<"tasks">, title: string) => Promise<void>;
};

const PRIORITY_STYLES: Record<BoardTaskDoc["priority"], string> = {
  urgent: "border-red-500/35 bg-red-500/10 text-red-700",
  high: "border-orange-500/35 bg-orange-500/10 text-orange-700",
  medium: "border-blue-500/35 bg-blue-500/10 text-blue-700",
  low: "border-emerald-500/35 bg-emerald-500/10 text-emerald-700",
};

const PRIORITY_LABELS: Record<BoardTaskDoc["priority"], string> = {
  urgent: "Urgent",
  high: "Élevé",
  medium: "Moyen",
  low: "Faible",
};

export function BoardCard({ task, profileById, onOpen, onRename }: BoardCardProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [renaming, setRenaming] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id,
    disabled: editingTitle || renaming,
    data: {
      type: "task",
      taskId: task._id,
      columnId: task.columnId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dueLabel = formatBoardDate(task.dueDate);
  const checklistTotal = task.checklist.length;
  const checklistDone = task.checklist.filter((item) => item.done).length;
  const commentsCount = task.commentsCount ?? 0;

  const assignees = taskAssigneeIds(task)
    .map((id) => profileById.get(id))
    .filter((profile): profile is BoardProfileDoc => !!profile);

  const visibleAssignees = assignees.slice(0, 3);
  const hiddenAssignees = Math.max(assignees.length - visibleAssignees.length, 0);

  useEffect(() => {
    if (editingTitle) return;
    setTitleDraft(task.title);
  }, [editingTitle, task.title]);

  async function submitTitleRename() {
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      setTitleDraft(task.title);
      setEditingTitle(false);
      return;
    }
    if (nextTitle === task.title) {
      setEditingTitle(false);
      return;
    }

    setRenaming(true);
    try {
      await onRename(task._id, nextTitle);
      setEditingTitle(false);
    } finally {
      setRenaming(false);
    }
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!editingTitle && !renaming) {
          onOpen(task._id);
        }
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (editingTitle) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(task._id);
        }
      }}
      className={cn(
        "cursor-grab rounded-xl border border-border/70 bg-background/90 p-3 shadow-sm transition-shadow active:cursor-grabbing",
        "hover:shadow-md",
        isDragging && "opacity-70 shadow-lg",
        editingTitle && "cursor-default active:cursor-default",
      )}
    >
      <div className="w-full text-left">
        <div className="mb-1 flex items-start justify-between gap-2">
          {editingTitle ? (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                event.stopPropagation();
                await submitTitleRename();
              }}
              className="min-w-0 flex-1"
            >
              <Input
                autoFocus
                value={titleDraft}
                disabled={renaming}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={async () => {
                  await submitTitleRename();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setTitleDraft(task.title);
                    setEditingTitle(false);
                  }
                }}
                onPointerDown={(event) => event.stopPropagation()}
                className="h-8 text-sm"
              />
            </form>
          ) : (
            <p className="line-clamp-2 min-w-0 flex-1 text-sm font-medium">{task.title}</p>
          )}

          {!editingTitle ? (
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Renommer la carte"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                setTitleDraft(task.title);
                setEditingTitle(true);
              }}
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {task.tags && task.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border px-2 py-0 text-[11px]"
                style={getTagChipStyle(tag)}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {dueLabel ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-border/70 px-1.5 py-0.5">
              <CalendarClock className="h-3.5 w-3.5" />
              {dueLabel}
            </span>
          ) : null}

          <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5", PRIORITY_STYLES[task.priority])}>
            {PRIORITY_LABELS[task.priority]}
          </span>

          {checklistTotal > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-border/70 px-1.5 py-0.5">
              <ListChecks className="h-3.5 w-3.5" />
              {checklistDone}/{checklistTotal}
            </span>
          ) : null}

          {commentsCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-border/70 px-1.5 py-0.5">
              <MessageSquareText className="h-3.5 w-3.5" />
              {commentsCount}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex-1" />
        {assignees.length > 0 ? (
          <AvatarGroup className="justify-end">
            {visibleAssignees.map((profile) => (
              <Avatar key={profile._id} size="sm">
                <AvatarFallback>{profileInitials(profile.displayName || profile.email)}</AvatarFallback>
              </Avatar>
            ))}
            {hiddenAssignees > 0 ? <AvatarGroupCount className="size-6 text-xs">+{hiddenAssignees}</AvatarGroupCount> : null}
          </AvatarGroup>
        ) : null}
      </div>

    </article>
  );
}
