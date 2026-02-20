import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import type { Id } from "../../../../convex/_generated/dataModel";

import { api } from "../../../../convex/_generated/api";
import type {
  BoardColumnDoc,
  BoardFilter,
  BoardProfileDoc,
  BoardSpaceDoc,
  BoardTaskDoc,
} from "./board-types";
import { hasTaskAssignee } from "./board-types";

type DropTarget =
  | { kind: "task"; instanceId: Id<"boardCardInstances"> }
  | { kind: "column"; columnId: Id<"boardColumns"> };

type ColumnSortMode = "priority" | "dueDate" | "title";

type CreateSpacePayload = {
  name: string;
  description?: string;
  color?: string;
  visibility: "private" | "shared";
  memberIds: Id<"profiles">[];
};

function sortBoardTasks(a: BoardTaskDoc, b: BoardTaskDoc) {
  if ((a.columnId ?? "") !== (b.columnId ?? "")) {
    return String(a.columnId ?? "").localeCompare(String(b.columnId ?? ""));
  }
  if ((a.order ?? 0) !== (b.order ?? 0)) {
    return (a.order ?? 0) - (b.order ?? 0);
  }
  return a._creationTime - b._creationTime;
}

function sortBoardColumns(a: BoardColumnDoc, b: BoardColumnDoc) {
  if (a.order !== b.order) return a.order - b.order;
  return a._creationTime - b._creationTime;
}

function positionsMatch(clientTasks: BoardTaskDoc[], serverTasks: BoardTaskDoc[]) {
  if (clientTasks.length !== serverTasks.length) return false;
  const serverById = new Map(serverTasks.map((task) => [task.instanceId, task]));
  for (const clientTask of clientTasks) {
    const serverTask = serverById.get(clientTask.instanceId);
    if (!serverTask) return false;
    if ((clientTask.columnId ?? "") !== (serverTask.columnId ?? "")) return false;
    if ((clientTask.order ?? 0) !== (serverTask.order ?? 0)) return false;
  }
  return true;
}

function columnPositionsMatch(clientColumns: BoardColumnDoc[], serverColumns: BoardColumnDoc[]) {
  if (clientColumns.length !== serverColumns.length) return false;
  const serverById = new Map(serverColumns.map((column) => [column._id, column]));
  for (const clientColumn of clientColumns) {
    const serverColumn = serverById.get(clientColumn._id);
    if (!serverColumn) return false;
    if (clientColumn.order !== serverColumn.order) return false;
    if (clientColumn.name !== serverColumn.name) return false;
  }
  return true;
}

function columnTasksMap(tasks: BoardTaskDoc[]) {
  const map = new Map<Id<"boardColumns">, BoardTaskDoc[]>();
  for (const task of tasks) {
    if (!task.columnId) continue;
    const list = map.get(task.columnId) ?? [];
    list.push(task);
    map.set(task.columnId, list);
  }
  for (const [columnId, list] of map.entries()) {
    map.set(columnId, list.slice().sort(sortBoardTasks));
  }
  return map;
}

function normalizeOrders(
  tasks: BoardTaskDoc[],
  columnId: Id<"boardColumns">,
  startStep = 1000,
) {
  return tasks.map((task, index) => ({
    ...task,
    columnId,
    order: (index + 1) * startStep,
  }));
}

function normalizeColumnOrders(columns: BoardColumnDoc[], startStep = 1000) {
  return columns.map((column, index) => ({
    ...column,
    order: (index + 1) * startStep,
  }));
}

function comparePriority(a: BoardTaskDoc, b: BoardTaskDoc) {
  const rank: Record<BoardTaskDoc["priority"], number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return rank[a.priority] - rank[b.priority];
}

function compareDueDate(a: BoardTaskDoc, b: BoardTaskDoc) {
  const ad = a.dueDate ? new Date(`${a.dueDate}T12:00:00`).getTime() : Number.POSITIVE_INFINITY;
  const bd = b.dueDate ? new Date(`${b.dueDate}T12:00:00`).getTime() : Number.POSITIVE_INFINITY;
  if (ad !== bd) return ad - bd;
  return a.title.localeCompare(b.title, "fr");
}

function compareTitle(a: BoardTaskDoc, b: BoardTaskDoc) {
  return a.title.localeCompare(b.title, "fr");
}

function normalizeString(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function resolveDropTarget(over: DragEndEvent["over"] | DragOverEvent["over"]) {
  if (!over) return null;

  const overData = over.data.current as
    | {
      type?: "task" | "column" | "board-column";
      instanceId?: Id<"boardCardInstances">;
      columnId?: Id<"boardColumns">;
    }
    | undefined;

  if (overData?.type === "task" && overData.instanceId) {
    return { kind: "task", instanceId: overData.instanceId } satisfies DropTarget;
  }

  if (overData?.type === "column" && overData.columnId) {
    return { kind: "column", columnId: overData.columnId } satisfies DropTarget;
  }
  if (overData?.type === "board-column" && overData.columnId) {
    return { kind: "column", columnId: overData.columnId } satisfies DropTarget;
  }

  const overId = String(over.id);
  if (overId.startsWith("column:")) {
    return {
      kind: "column",
      columnId: overId.slice("column:".length) as Id<"boardColumns">,
    } satisfies DropTarget;
  }

  return null;
}

function resolveColumnDropTarget(over: DragEndEvent["over"] | DragOverEvent["over"]) {
  if (!over) return null;

  const overData = over.data.current as
    | { type?: "board-column" | "column" | "task"; columnId?: Id<"boardColumns"> }
    | undefined;

  if ((overData?.type === "board-column" || overData?.type === "column") && overData.columnId) {
    return overData.columnId;
  }
  if (overData?.type === "task" && overData.columnId) {
    return overData.columnId;
  }

  const overId = String(over.id);
  if (overId.startsWith("board-column:")) {
    return overId.slice("board-column:".length) as Id<"boardColumns">;
  }
  if (overId.startsWith("column:")) {
    return overId.slice("column:".length) as Id<"boardColumns">;
  }

  return null;
}

function reorderBoardTasks(
  tasks: BoardTaskDoc[],
  activeInstanceId: Id<"boardCardInstances">,
  target: DropTarget,
) {
  const activeTask = tasks.find((task) => task.instanceId === activeInstanceId);
  if (!activeTask?.columnId) return null;

  let destinationColumnId: Id<"boardColumns"> | null = null;
  let overInstanceId: Id<"boardCardInstances"> | null = null;

  if (target.kind === "column") {
    destinationColumnId = target.columnId;
  } else {
    const overTask = tasks.find((task) => task.instanceId === target.instanceId);
    if (!overTask?.columnId) return null;
    destinationColumnId = overTask.columnId;
    overInstanceId = overTask.instanceId;
  }

  if (!destinationColumnId) return null;

  const map = columnTasksMap(tasks);
  const sourceColumnId = activeTask.columnId;
  const sourceList = (map.get(sourceColumnId) ?? []).slice();

  const sourceIndex = sourceList.findIndex((task) => task.instanceId === activeInstanceId);
  if (sourceIndex < 0) return null;

  sourceList.splice(sourceIndex, 1);

  const sameColumn = sourceColumnId === destinationColumnId;
  const destinationList = sameColumn
    ? sourceList
    : (map.get(destinationColumnId) ?? []).slice();

  let targetIndex = destinationList.length;
  if (overInstanceId) {
    const foundIndex = destinationList.findIndex((task) => task.instanceId === overInstanceId);
    if (foundIndex >= 0) targetIndex = foundIndex;
  }

  destinationList.splice(targetIndex, 0, {
    ...activeTask,
    columnId: destinationColumnId,
  });

  const normalizedSource = sameColumn
    ? normalizeOrders(destinationList, sourceColumnId)
    : normalizeOrders(sourceList, sourceColumnId);
  const normalizedDestination = sameColumn
    ? normalizedSource
    : normalizeOrders(destinationList, destinationColumnId);

  const nextTaskById = new Map<Id<"boardCardInstances">, BoardTaskDoc>(tasks.map((task) => [task.instanceId, task]));
  for (const next of normalizedSource) {
    nextTaskById.set(next.instanceId, next);
  }
  for (const next of normalizedDestination) {
    nextTaskById.set(next.instanceId, next);
  }

  const nextTasks = tasks.map((task) => nextTaskById.get(task.instanceId) ?? task);
  const updatesMap = new Map<Id<"boardCardInstances">, { instanceId: Id<"boardCardInstances">; columnId: Id<"boardColumns">; order: number }>();

  for (const next of [...normalizedSource, ...normalizedDestination]) {
    const previous = tasks.find((task) => task.instanceId === next.instanceId);
    if (!previous?.columnId) continue;
    if (!next.columnId) continue;
    if ((previous.columnId ?? "") === (next.columnId ?? "") && (previous.order ?? 0) === (next.order ?? 0)) {
      continue;
    }
    updatesMap.set(next.instanceId, {
      instanceId: next.instanceId,
      columnId: next.columnId,
      order: next.order ?? 0,
    });
  }

  return {
    nextTasks,
    updates: [...updatesMap.values()],
  };
}

export function useMissionsBoard() {
  const spaces = useQuery(api.board.listSpaces);
  const profiles = useQuery(api.profiles.listVisibleProfiles);
  const directoryProfiles = useQuery(api.profiles.listDirectoryProfiles);
  const currentProfile = useQuery(api.profiles.getCurrentProfile);

  const ensureBoardSetup = useMutation(api.board.ensureBoardSetup);
  const createSpace = useMutation(api.board.createSpace);
  const updateBoardColumn = useMutation(api.board.updateBoardColumn);
  const batchUpdateColumnOrders = useMutation(api.board.batchUpdateColumnOrders);
  const createBoardTask = useMutation(api.board.createBoardTask);
  const batchUpdatePositions = useMutation(api.board.batchUpdatePositions);
  const updateBoardTaskDetails = useMutation(api.board.updateBoardTaskDetails);
  const addChecklistItem = useMutation(api.board.addChecklistItem);
  const toggleChecklistItem = useMutation(api.board.toggleChecklistItem);
  const duplicateCard = useMutation(api.board.duplicateCard);

  const [taskFilter, setTaskFilter] = useState<BoardFilter>("all");
  const [searchValue, setSearchValue] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<Id<"tasks"> | null>(null);
  const [activeTaskInstanceId, setActiveTaskInstanceId] = useState<Id<"boardCardInstances"> | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<Id<"boardColumns"> | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<Id<"spaces"> | null>(null);
  const [optimisticColumns, setOptimisticColumns] = useState<BoardColumnDoc[] | null>(null);
  const [optimisticTasks, setOptimisticTasks] = useState<BoardTaskDoc[] | null>(null);
  const [setupReady, setSetupReady] = useState(false);

  const setupTriggeredRef = useRef(false);

  useEffect(() => {
    if (setupTriggeredRef.current) return;
    setupTriggeredRef.current = true;
    void ensureBoardSetup({})
      .then(() => {
        setSetupReady(true);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Impossible d'initialiser le board.";
        toast.error(message);
        setSetupReady(true);
      });
  }, [ensureBoardSetup]);

  const typedSpaces = useMemo(() => (spaces ?? []) as BoardSpaceDoc[], [spaces]);

  const activeSpaceId = useMemo(() => {
    if (selectedSpaceId && typedSpaces.some((space) => space._id === selectedSpaceId)) {
      return selectedSpaceId;
    }
    const personal = currentProfile
      ? typedSpaces.find((space) => space.kind === "personal" && space.ownerId === currentProfile._id)
      : null;
    const team = typedSpaces.find((space) => space.kind === "team");
    return personal?._id ?? team?._id ?? typedSpaces[0]?._id ?? null;
  }, [currentProfile, selectedSpaceId, typedSpaces]);

  const boardData = useQuery(
    api.board.getBoardData,
    activeSpaceId ? { spaceId: activeSpaceId } : "skip",
  );

  const serverColumns = useMemo(
    () => (boardData?.columns ?? []).slice().sort(sortBoardColumns),
    [boardData?.columns],
  );

  const serverTasks = useMemo(
    () => ((boardData?.tasks ?? []) as BoardTaskDoc[]).slice().sort(sortBoardTasks),
    [boardData?.tasks],
  );

  const columnsCaughtUp = useMemo(
    () => (optimisticColumns ? columnPositionsMatch(optimisticColumns, serverColumns) : false),
    [optimisticColumns, serverColumns],
  );

  const columns = useMemo(
    () => (columnsCaughtUp ? serverColumns : optimisticColumns ?? serverColumns).slice().sort(sortBoardColumns),
    [columnsCaughtUp, optimisticColumns, serverColumns],
  );

  const serverCaughtUp = useMemo(
    () => (optimisticTasks ? positionsMatch(optimisticTasks, serverTasks) : false),
    [optimisticTasks, serverTasks],
  );

  const allTasks = useMemo(
    () => (serverCaughtUp ? serverTasks : optimisticTasks ?? serverTasks).slice().sort(sortBoardTasks),
    [optimisticTasks, serverCaughtUp, serverTasks],
  );

  const profileById = useMemo(() => {
    const map = new Map<Id<"profiles">, BoardProfileDoc>();
    for (const profile of profiles ?? []) {
      map.set(profile._id, profile);
    }
    return map;
  }, [profiles]);

  const tagOptions = useMemo(() => {
    const tags = new Set<string>();
    for (const task of allTasks) {
      for (const tag of task.tags ?? []) {
        if (tag.trim().length > 0) tags.add(tag);
      }
    }
    return [...tags].sort((a, b) => a.localeCompare(b, "fr"));
  }, [allTasks]);

  const visibleTasks = useMemo(() => {
    const search = searchValue.trim().toLocaleLowerCase("fr-FR");
    return allTasks.filter((task) => {
      if (taskFilter === "urgent" && task.priority !== "urgent") {
        return false;
      }
      if (taskFilter === "mine" && currentProfile) {
        if (!hasTaskAssignee(task, currentProfile._id)) {
          return false;
        }
      }
      if (selectedTags.length > 0) {
        const taskTags = new Set(task.tags ?? []);
        if (!selectedTags.some((tag) => taskTags.has(tag))) {
          return false;
        }
      }
      if (!search) return true;

      const haystack = [
        task.title,
        task.description ?? "",
        task.notes ?? task.note ?? "",
        ...(task.tags ?? []),
      ]
        .join(" ")
        .toLocaleLowerCase("fr-FR");

      return haystack.includes(search);
    });
  }, [allTasks, currentProfile, searchValue, selectedTags, taskFilter]);

  const tasksByColumn = useMemo(() => {
    const map = new Map<Id<"boardColumns">, BoardTaskDoc[]>();
    for (const column of columns) {
      map.set(column._id, []);
    }
    for (const task of visibleTasks) {
      if (!task.columnId) continue;
      const list = map.get(task.columnId);
      if (!list) continue;
      list.push(task);
    }
    for (const [columnId, tasks] of map.entries()) {
      map.set(columnId, tasks.slice().sort(sortBoardTasks));
    }
    return map;
  }, [columns, visibleTasks]);

  const selectedTask = useMemo(
    () => allTasks.find((task) => task.cardId === selectedTaskId) ?? null,
    [allTasks, selectedTaskId],
  );

  const activeTask = useMemo(
    () => allTasks.find((task) => task.instanceId === activeTaskInstanceId) ?? null,
    [activeTaskInstanceId, allTasks],
  );

  const activeColumn = useMemo(
    () => columns.find((column) => column._id === activeColumnId) ?? null,
    [activeColumnId, columns],
  );

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag],
    );
  }

  function clearTags() {
    setSelectedTags([]);
  }

  async function createSpaceWithMembers(payload: CreateSpacePayload) {
    try {
      const created = await createSpace({
        name: payload.name,
        description: payload.description,
        color: payload.color,
        visibility: payload.visibility,
        memberIds: payload.memberIds,
      });
      setSelectedSpaceId(created._id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de créer l'espace.";
      toast.error(message);
      throw error;
    }
  }

  async function createCard(columnId: Id<"boardColumns">, title: string) {
    if (!activeSpaceId) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    const columnTasks = allTasks.filter((task) => task.columnId === columnId);
    const maxOrder = columnTasks.reduce((max, task) => Math.max(max, task.order ?? 0), 0);

    try {
      await createBoardTask({
        spaceId: activeSpaceId,
        title: cleanTitle,
        columnId,
        order: maxOrder + 1000,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de créer la carte.";
      toast.error(message);
    }
  }

  async function saveTaskDetails(
    cardId: Id<"tasks">,
    payload: {
      title: string;
      description: string | null;
      notes: string | null;
      dueDate: string | null;
      priority: "urgent" | "high" | "medium" | "low";
      assigneeProfileIds: Id<"profiles">[];
      tags: string[];
    },
  ) {
    if (!activeSpaceId) return;

    try {
      await updateBoardTaskDetails({
        spaceId: activeSpaceId,
        cardId,
        title: payload.title,
        description: payload.description,
        notes: payload.notes,
        dueDate: payload.dueDate,
        priority: payload.priority,
        assigneeProfileIds: payload.assigneeProfileIds,
        tags: payload.tags,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible d'enregistrer la carte.";
      toast.error(message);
      throw error;
    }
  }

  async function renameTaskTitle(cardId: Id<"tasks">, title: string) {
    if (!activeSpaceId) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const task = allTasks.find((item) => item.cardId === cardId);
    if (!task) return;
    if (task.title === cleanTitle) return;

    try {
      await updateBoardTaskDetails({
        spaceId: activeSpaceId,
        cardId,
        title: cleanTitle,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de renommer la carte.";
      toast.error(message);
    }
  }

  async function renameColumn(columnId: Id<"boardColumns">, name: string) {
    if (!activeSpaceId) return;

    const nextName = name.trim();
    if (!nextName) return;
    const column = columns.find((item) => item._id === columnId);
    if (!column) return;
    if (column.name === nextName) return;

    const snapshot = columns;
    const optimistic = columns.map((item) =>
      item._id === columnId ? { ...item, name: nextName } : item,
    );
    setOptimisticColumns(optimistic);

    try {
      await updateBoardColumn({ spaceId: activeSpaceId, columnId, name: nextName });
    } catch (error) {
      setOptimisticColumns(snapshot);
      const message = error instanceof Error ? error.message : "Impossible de renommer la liste.";
      toast.error(message);
    }
  }

  async function applyColumnOrderUpdates(
    nextColumns: BoardColumnDoc[],
    updates: Array<{ columnId: Id<"boardColumns">; order: number }>,
    errorMessage: string,
  ) {
    if (!activeSpaceId) return;
    if (updates.length === 0) return;

    const snapshot = columns;
    setOptimisticColumns(nextColumns);

    try {
      await batchUpdateColumnOrders({ spaceId: activeSpaceId, updates });
    } catch (error) {
      setOptimisticColumns(snapshot);
      const message = error instanceof Error ? error.message : errorMessage;
      toast.error(message);
    }
  }

  async function applyPositionUpdates(
    nextTasks: BoardTaskDoc[],
    updates: Array<{ instanceId: Id<"boardCardInstances">; columnId: Id<"boardColumns">; order: number }>,
    errorMessage: string,
  ) {
    if (!activeSpaceId) return;
    if (updates.length === 0) return;

    const snapshot = allTasks;
    setOptimisticTasks(nextTasks);

    try {
      await batchUpdatePositions({ spaceId: activeSpaceId, updates });
    } catch (error) {
      setOptimisticTasks(snapshot);
      const message = error instanceof Error ? error.message : errorMessage;
      toast.error(message);
    }
  }

  async function reorderColumns(
    activeColumnIdValue: Id<"boardColumns">,
    targetColumnId: Id<"boardColumns">,
  ) {
    if (activeColumnIdValue === targetColumnId) return;

    const current = columns.slice().sort(sortBoardColumns);
    const sourceIndex = current.findIndex((column) => column._id === activeColumnIdValue);
    const targetIndex = current.findIndex((column) => column._id === targetColumnId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const next = current.slice();
    const [moved] = next.splice(sourceIndex, 1);
    if (!moved) return;
    next.splice(targetIndex, 0, moved);

    const normalized = normalizeColumnOrders(next);
    const updates = normalized
      .map((column) => ({
        columnId: column._id,
        order: column.order,
      }))
      .filter((update) => {
        const previous = current.find((column) => column._id === update.columnId);
        return !!previous && previous.order !== update.order;
      });

    await applyColumnOrderUpdates(normalized, updates, "Impossible de déplacer la liste.");
  }

  async function sortColumnCards(columnId: Id<"boardColumns">, mode: ColumnSortMode) {
    const columnTasks = allTasks
      .filter((task) => task.columnId === columnId)
      .slice()
      .sort(sortBoardTasks);
    if (columnTasks.length < 2) return;

    const sorted = columnTasks
      .slice()
      .sort((a, b) => {
        if (mode === "priority") return comparePriority(a, b);
        if (mode === "dueDate") return compareDueDate(a, b);
        return compareTitle(a, b);
      });
    const normalized = normalizeOrders(sorted, columnId);

    const updates = normalized
      .map((task) => ({
        instanceId: task.instanceId,
        columnId,
        order: task.order ?? 0,
      }))
      .filter((update) => {
        const current = allTasks.find((task) => task.instanceId === update.instanceId);
        return !!current && (current.order ?? 0) !== update.order;
      });

    if (updates.length === 0) return;

    const byId = new Map(allTasks.map((task) => [task.instanceId, task]));
    for (const update of updates) {
      const task = byId.get(update.instanceId);
      if (!task) continue;
      byId.set(update.instanceId, { ...task, order: update.order });
    }
    const nextTasks = allTasks.map((task) => byId.get(task.instanceId) ?? task);

    await applyPositionUpdates(nextTasks, updates, "Impossible de trier la colonne.");
  }

  async function moveAllCardsToColumn(
    sourceColumnId: Id<"boardColumns">,
    targetColumnId: Id<"boardColumns">,
  ) {
    if (sourceColumnId === targetColumnId) return;

    const sourceTasks = allTasks
      .filter((task) => task.columnId === sourceColumnId)
      .slice()
      .sort(sortBoardTasks);
    if (sourceTasks.length === 0) return;

    const targetTasks = allTasks
      .filter((task) => task.columnId === targetColumnId)
      .slice()
      .sort(sortBoardTasks);
    const maxTargetOrder = targetTasks.reduce((max, task) => Math.max(max, task.order ?? 0), 0);

    const updates = sourceTasks.map((task, index) => ({
      instanceId: task.instanceId,
      columnId: targetColumnId,
      order: maxTargetOrder + (index + 1) * 1000,
    }));

    const nextById = new Map(allTasks.map((task) => [task.instanceId, task]));
    for (const update of updates) {
      const task = nextById.get(update.instanceId);
      if (!task) continue;
      nextById.set(update.instanceId, {
        ...task,
        columnId: update.columnId,
        order: update.order,
      });
    }
    const nextTasks = allTasks.map((task) => nextById.get(task.instanceId) ?? task);

    await applyPositionUpdates(nextTasks, updates, "Impossible de déplacer les cartes de la liste.");
  }

  async function archiveColumnCards(columnId: Id<"boardColumns">) {
    const doneColumn = columns.find((column) => normalizeString(column.name).includes("termine"));
    if (!doneColumn) {
      toast.error('Colonne "Terminé" introuvable.');
      return;
    }
    await moveAllCardsToColumn(columnId, doneColumn._id);
  }

  async function createChecklistItem(cardId: Id<"tasks">, text: string) {
    if (!activeSpaceId) return;

    try {
      await addChecklistItem({ spaceId: activeSpaceId, cardId, text });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible d'ajouter l'item checklist.";
      toast.error(message);
      throw error;
    }
  }

  async function toggleChecklist(cardId: Id<"tasks">, itemId: string) {
    if (!activeSpaceId) return;

    try {
      await toggleChecklistItem({ spaceId: activeSpaceId, cardId, itemId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de modifier la checklist.";
      toast.error(message);
      throw error;
    }
  }

  async function duplicateBoardCard(cardId: Id<"tasks">, targetSpaceId: Id<"spaces">, syncWithOriginal: boolean) {
    if (!activeSpaceId) return;

    try {
      await duplicateCard({
        sourceSpaceId: activeSpaceId,
        targetSpaceId,
        cardId,
        syncWithOriginal,
      });
      toast.success(syncWithOriginal ? "Carte synchronisée vers le nouvel espace." : "Copie indépendante créée.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de dupliquer la carte.";
      toast.error(message);
      throw error;
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as
      | { type?: "task"; instanceId?: Id<"boardCardInstances"> }
      | { type?: "board-column"; columnId?: Id<"boardColumns"> }
      | undefined;

    if (data?.type === "task") {
      setActiveTaskInstanceId(data.instanceId ?? (event.active.id as Id<"boardCardInstances">));
      setActiveColumnId(null);
      return;
    }

    if (data?.type === "board-column") {
      const resolvedId =
        data.columnId ??
        (String(event.active.id).replace("board-column:", "") as Id<"boardColumns">);
      setActiveColumnId(resolvedId);
      setActiveTaskInstanceId(null);
    }
  }

  function handleDragCancel() {
    setActiveTaskInstanceId(null);
    setActiveColumnId(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const activeData = event.active.data.current as
      | { type?: "task"; instanceId?: Id<"boardCardInstances"> }
      | { type?: "board-column"; columnId?: Id<"boardColumns"> }
      | undefined;
    setActiveTaskInstanceId(null);
    setActiveColumnId(null);

    if (!event.over) return;

    if (activeData?.type === "board-column") {
      const activeId =
        activeData.columnId ??
        (String(event.active.id).replace("board-column:", "") as Id<"boardColumns">);
      const overColumnId = resolveColumnDropTarget(event.over);
      if (!overColumnId) return;
      await reorderColumns(activeId, overColumnId);
      return;
    }

    if (activeData?.type !== "task") return;

    const activeId = activeData.instanceId ?? (event.active.id as Id<"boardCardInstances">);
    const target = resolveDropTarget(event.over);
    if (!target) return;

    const result = reorderBoardTasks(allTasks, activeId, target);
    if (!result || result.updates.length === 0) return;

    const snapshot = allTasks;
    setOptimisticTasks(result.nextTasks);

    if (!activeSpaceId) return;

    try {
      await batchUpdatePositions({ spaceId: activeSpaceId, updates: result.updates });
    } catch (error) {
      setOptimisticTasks(snapshot);
      const message = error instanceof Error ? error.message : "Impossible d'enregistrer le déplacement.";
      toast.error(message);
    }
  }

  return {
    isLoading:
      !setupReady ||
      spaces === undefined ||
      profiles === undefined ||
      directoryProfiles === undefined ||
      (activeSpaceId ? boardData === undefined : true),
    spaces: typedSpaces,
    selectedSpaceId: activeSpaceId,
    setSelectedSpaceId,
    columns,
    tasksByColumn,
    allTasks,
    tagOptions,
    selectedTags,
    toggleTag,
    clearTags,
    taskFilter,
    setTaskFilter,
    searchValue,
    setSearchValue,
    selectedTask,
    selectedTaskId,
    setSelectedTaskId,
    activeTask,
    activeColumn,
    currentProfile,
    profiles: profiles ?? [],
    directoryProfiles: directoryProfiles ?? [],
    profileById,
    createSpaceWithMembers,
    createCard,
    saveTaskDetails,
    renameTaskTitle,
    renameColumn,
    sortColumnCards,
    moveAllCardsToColumn,
    archiveColumnCards,
    createChecklistItem,
    toggleChecklist,
    duplicateBoardCard,
    handleDragStart,
    handleDragCancel,
    handleDragEnd,
  };
}
