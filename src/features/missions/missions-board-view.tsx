"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";

import { BoardHeader } from "@/features/missions/board/board-header";
import { CardDetailDrawer } from "@/features/missions/board/card-detail-drawer";
import { ColumnList } from "@/features/missions/board/column-list";
import { DuplicateCardDialog } from "@/features/missions/board/duplicate-card-dialog";
import { useMissionsBoard } from "@/features/missions/board/use-missions-board";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function MissionsBoardView() {
  const board = useMissionsBoard();
  const [duplicateCardId, setDuplicateCardId] = useState<Id<"tasks"> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (board.isLoading) {
    return (
      <div className="space-y-4">
        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle>Missions Board</CardTitle>
            <CardDescription>Chargement du board...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-40 rounded-xl border border-dashed border-border/70" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-card/70">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Board Missions</CardTitle>
          <CardDescription>
            Organisation Trello-like des exceptions du jour: glisse-dépose, filtres, recherche et détail carte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <BoardHeader
            spaces={board.spaces}
            selectedSpaceId={board.selectedSpaceId}
            onSpaceChange={board.setSelectedSpaceId}
            directoryProfiles={board.directoryProfiles}
            onCreateSpace={board.createSpaceWithMembers}
            canDeleteSelectedSpace={board.canDeleteSelectedSpace}
            onDeleteSelectedSpace={board.deleteSelectedSpace}
            taskFilter={board.taskFilter}
            onTaskFilterChange={board.setTaskFilter}
            searchValue={board.searchValue}
            onSearchValueChange={board.setSearchValue}
            tagOptions={board.tagOptions}
            selectedTags={board.selectedTags}
            onToggleTag={board.toggleTag}
            onClearTags={board.clearTags}
          />

          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={board.handleDragStart}
            onDragCancel={board.handleDragCancel}
            onDragEnd={board.handleDragEnd}
          >
            <ColumnList
              columns={board.columns}
              tasksByColumn={board.tasksByColumn}
              profileById={board.profileById}
              onOpenTask={board.setSelectedTaskId}
              onCreateCard={board.createCard}
              onRenameCard={board.renameTaskTitle}
              onDuplicateCard={setDuplicateCardId}
              onRenameColumn={board.renameColumn}
              onSortCards={board.sortColumnCards}
              onMoveAllCards={board.moveAllCardsToColumn}
              onArchiveColumnCards={board.archiveColumnCards}
            />

            <DragOverlay>
              {board.activeTask ? (
                <article className="w-[320px] rounded-xl border border-border/70 bg-background/95 p-3 shadow-lg">
                  <p className="text-sm font-medium">{board.activeTask.title}</p>
                </article>
              ) : board.activeColumn ? (
                <article className="w-[320px] rounded-2xl border border-border/70 bg-card/95 p-3 shadow-lg">
                  <p className="text-sm font-semibold">{board.activeColumn.name}</p>
                </article>
              ) : null}
            </DragOverlay>
          </DndContext>
        </CardContent>
      </Card>

      <CardDetailDrawer
        open={!!board.selectedTask}
        onOpenChange={(open) => {
          if (!open) board.setSelectedTaskId(null);
        }}
        task={board.selectedTask}
        profiles={board.profiles}
        onSave={board.saveTaskDetails}
        onToggleChecklist={board.toggleChecklist}
        onAddChecklistItem={board.createChecklistItem}
        onDuplicateRequest={setDuplicateCardId}
        onDelete={board.deleteCardFromSelectedSpace}
      />

      <DuplicateCardDialog
        open={!!duplicateCardId}
        onOpenChange={(open) => {
          if (!open) setDuplicateCardId(null);
        }}
        spaces={board.spaces}
        currentSpaceId={board.selectedSpaceId}
        onConfirm={async (targetSpaceId, syncWithOriginal) => {
          if (!duplicateCardId) return;
          await board.duplicateBoardCard(duplicateCardId, targetSpaceId, syncWithOriginal);
        }}
      />
    </div>
  );
}
