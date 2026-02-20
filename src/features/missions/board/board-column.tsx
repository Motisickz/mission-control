import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Id } from "../../../../convex/_generated/dataModel";
import { GripVertical, MoreHorizontal, PencilLine, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import type { BoardColumnDoc, BoardProfileDoc, BoardTaskDoc } from "./board-types";
import { BoardCard } from "./board-card";
import { CreateCardInline } from "./create-card-inline";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

type BoardColumnProps = {
  column: BoardColumnDoc;
  columns: BoardColumnDoc[];
  tasks: BoardTaskDoc[];
  profileById: Map<Id<"profiles">, BoardProfileDoc>;
  onOpenTask: (taskId: Id<"tasks">) => void;
  onCreateCard: (columnId: Id<"boardColumns">, title: string) => Promise<void> | void;
  onRenameCard: (taskId: Id<"tasks">, title: string) => Promise<void>;
  onDuplicateCard: (taskId: Id<"tasks">) => void;
  onRenameColumn: (columnId: Id<"boardColumns">, name: string) => Promise<void>;
  onSortCards: (columnId: Id<"boardColumns">, mode: "priority" | "dueDate" | "title") => Promise<void>;
  onMoveAllCards: (sourceColumnId: Id<"boardColumns">, targetColumnId: Id<"boardColumns">) => Promise<void>;
  onArchiveColumnCards: (columnId: Id<"boardColumns">) => Promise<void>;
};

export function BoardColumn({
  column,
  columns,
  tasks,
  profileById,
  onOpenTask,
  onCreateCard,
  onRenameCard,
  onDuplicateCard,
  onRenameColumn,
  onSortCards,
  onMoveAllCards,
  onArchiveColumnCards,
}: BoardColumnProps) {
  const [addCardSignal, setAddCardSignal] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(column.name);
  const [renamingName, setRenamingName] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `board-column:${column._id}`,
    disabled: editingName || renamingName,
    data: {
      type: "board-column",
      columnId: column._id,
    },
  });

  useEffect(() => {
    if (editingName) return;
    setNameDraft(column.name);
  }, [column.name, editingName]);

  const { isOver, setNodeRef } = useDroppable({
    id: `column:${column._id}`,
    data: {
      type: "column",
      columnId: column._id,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  async function submitColumnRename() {
    const nextName = nameDraft.trim();
    if (!nextName) {
      setNameDraft(column.name);
      setEditingName(false);
      return;
    }
    if (nextName === column.name) {
      setEditingName(false);
      return;
    }

    setRenamingName(true);
    try {
      await onRenameColumn(column._id, nextName);
      setEditingName(false);
    } finally {
      setRenamingName(false);
    }
  }

  return (
    <section
      ref={setSortableRef}
      style={style}
      className={cn(
        "w-[320px] shrink-0 rounded-2xl border border-border/70 bg-card/80 p-3",
        isDragging && "opacity-80 shadow-lg",
      )}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {editingName ? (
            <form
              className="min-w-0"
              onSubmit={async (event) => {
                event.preventDefault();
                event.stopPropagation();
                await submitColumnRename();
              }}
            >
              <Input
                autoFocus
                value={nameDraft}
                disabled={renamingName}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={async () => {
                  await submitColumnRename();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setNameDraft(column.name);
                    setEditingName(false);
                  }
                }}
                onPointerDown={(event) => event.stopPropagation()}
                className="h-8 text-sm font-semibold"
              />
            </form>
          ) : (
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              className="flex w-full cursor-grab items-center gap-1 rounded-md px-1 py-0.5 text-left active:cursor-grabbing"
              title="Glisser pour déplacer la liste"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <h3 className="truncate text-sm font-semibold">{column.name}</h3>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{tasks.length}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setAddCardSignal((value) => value + 1)}
            onPointerDown={(event) => event.stopPropagation()}
            title="Ajouter une carte"
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Ajouter une carte</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Liste des actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  setNameDraft(column.name);
                  setEditingName(true);
                }}
              >
                <PencilLine className="h-4 w-4" />
                Renommer la liste
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Trier par...</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => void onSortCards(column._id, "priority")}>
                    Priorité
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void onSortCards(column._id, "dueDate")}>
                    Date limite
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void onSortCards(column._id, "title")}>
                    Titre
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Déplacer toutes les cartes</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {columns
                    .filter((item) => item._id !== column._id)
                    .map((targetColumn) => (
                      <DropdownMenuItem
                        key={targetColumn._id}
                        onClick={() => void onMoveAllCards(column._id, targetColumn._id)}
                      >
                        Vers {targetColumn.name}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => void onArchiveColumnCards(column._id)}
              >
                Archiver toutes les cartes de cette liste
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[120px] space-y-2 rounded-xl p-1 transition-colors",
          isOver && "bg-primary/10",
        )}
      >
        <CreateCardInline
          onCreate={(title) => onCreateCard(column._id, title)}
          openSignal={addCardSignal}
          hideClosedTrigger
        />

        <SortableContext items={tasks.map((task) => task.instanceId)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <BoardCard
              key={task.instanceId}
              task={task}
              profileById={profileById}
              onOpen={onOpenTask}
              onRename={onRenameCard}
              onDuplicate={onDuplicateCard}
            />
          ))}
        </SortableContext>
      </div>
    </section>
  );
}
