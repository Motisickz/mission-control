import type { Id } from "../../../../convex/_generated/dataModel";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";

import type { BoardColumnDoc, BoardProfileDoc, BoardTaskDoc } from "./board-types";
import { BoardColumn } from "./board-column";

type ColumnListProps = {
  columns: BoardColumnDoc[];
  tasksByColumn: Map<Id<"boardColumns">, BoardTaskDoc[]>;
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

export function ColumnList({
  columns,
  tasksByColumn,
  profileById,
  onOpenTask,
  onCreateCard,
  onRenameCard,
  onDuplicateCard,
  onRenameColumn,
  onSortCards,
  onMoveAllCards,
  onArchiveColumnCards,
}: ColumnListProps) {
  if (columns.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-6 text-sm text-muted-foreground">
        Initialisation des colonnes en cours...
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-3">
      <SortableContext
        items={columns.map((column) => `board-column:${column._id}`)}
        strategy={horizontalListSortingStrategy}
      >
        <div className="flex min-h-[60vh] gap-3">
          {columns.map((column) => (
            <BoardColumn
              key={column._id}
              column={column}
              columns={columns}
              tasks={tasksByColumn.get(column._id) ?? []}
              profileById={profileById}
              onOpenTask={onOpenTask}
              onCreateCard={onCreateCard}
              onRenameCard={onRenameCard}
              onDuplicateCard={onDuplicateCard}
              onRenameColumn={onRenameColumn}
              onSortCards={onSortCards}
              onMoveAllCards={onMoveAllCards}
              onArchiveColumnCards={onArchiveColumnCards}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
