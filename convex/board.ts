import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireProfile } from "./lib/auth";
import { areAllInAccessScope, getAccessProfileIds } from "./lib/sharedProfiles";
import {
  addMembersToSpace,
  assertSpaceAccess,
  ensureDefaultColumnsForSpace,
  ensurePersonalSpace,
  ensureTeamSpace,
  listAccessibleSpaces,
} from "./lib/boardSpaces";

type TaskRole = "admin" | "stagiaire";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeAssigneeProfileIds(
  profileId: Id<"profiles">,
  requested?: Id<"profiles">[],
) {
  const unique = new Set<Id<"profiles">>([profileId, ...(requested ?? [])]);
  return [...unique];
}

function normalizeTags(tags?: string[]) {
  const unique = new Set<string>();
  for (const tag of tags ?? []) {
    const value = tag.trim();
    if (!value) continue;
    unique.add(value);
  }
  return [...unique];
}

function normalizeChecklistItems(
  checklist?: {
    id: string;
    text: string;
    done: boolean;
  }[],
) {
  return (checklist ?? []).map((item) => ({
    id: item.id,
    label: item.text,
    text: item.text,
    done: item.done,
  }));
}

async function assertColumnExistsInSpace(
  ctx: MutationCtx | QueryCtx,
  columnId: Id<"boardColumns">,
  spaceId: Id<"spaces">,
) {
  const column = await ctx.db.get(columnId);
  if (!column) {
    throw new Error("Colonne introuvable");
  }
  if (column.spaceId !== spaceId) {
    throw new Error("La colonne n'appartient pas à cet espace");
  }
  return column;
}

async function getDefaultColumnIdForSpace(ctx: MutationCtx, spaceId: Id<"spaces">) {
  const columns = await ctx.db
    .query("boardColumns")
    .withIndex("by_space_order", (q) => q.eq("spaceId", spaceId))
    .collect();

  if (columns.length === 0) {
    await ensureDefaultColumnsForSpace(ctx, spaceId);
    const ensured = await ctx.db
      .query("boardColumns")
      .withIndex("by_space_order", (q) => q.eq("spaceId", spaceId))
      .collect();
    if (ensured.length === 0) {
      throw new Error("Aucune colonne disponible");
    }
    return ensured[0]._id;
  }

  columns.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a._creationTime - b._creationTime;
  });

  return columns[0]._id;
}

async function migrateLegacyBoardData(
  ctx: MutationCtx,
  teamSpaceId: Id<"spaces">,
  profile: { _id: Id<"profiles">; displayName: string; role: TaskRole; email: string },
) {
  const legacyColumns = (await ctx.db.query("boardColumns").collect()).filter((column) => !column.spaceId);

  if (legacyColumns.length > 0) {
    for (const column of legacyColumns) {
      await ctx.db.patch(column._id, { spaceId: teamSpaceId });
    }
  }

  const teamColumns = await ctx.db
    .query("boardColumns")
    .withIndex("by_space_order", (q) => q.eq("spaceId", teamSpaceId))
    .collect();

  if (teamColumns.length === 0) {
    await ensureDefaultColumnsForSpace(ctx, teamSpaceId);
  }

  const legacyBoardTasks = (await ctx.db
    .query("tasks")
    .withIndex("by_type", (q) => q.eq("type", "exception"))
    .collect()).filter((task) => !!task.columnId);

  const currentTeamColumns = await ctx.db
    .query("boardColumns")
    .withIndex("by_space_order", (q) => q.eq("spaceId", teamSpaceId))
    .collect();
  if (currentTeamColumns.length === 0) {
    throw new Error("Colonnes équipe introuvables");
  }

  const fallbackColumnId = currentTeamColumns
    .slice()
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a._creationTime - b._creationTime;
    })[0]._id;

  for (const task of legacyBoardTasks) {
    const targetColumnId = task.columnId ?? fallbackColumnId;
    const alreadyExists = await ctx.db
      .query("boardCardInstances")
      .withIndex("by_space_card", (q) => q.eq("spaceId", teamSpaceId).eq("cardId", task._id))
      .first();

    if (!alreadyExists) {
      const now = Date.now();
      await ctx.db.insert("boardCardInstances", {
        spaceId: teamSpaceId,
        cardId: task._id,
        columnId: targetColumnId,
        order: task.order ?? 1000,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (!task.boardCard) {
      await ctx.db.patch(task._id, {
        boardCard: true,
      });
    }
  }

  await ensurePersonalSpace(ctx, profile._id, profile.displayName);
}

async function ensureBoardSetupForCurrentUser(ctx: MutationCtx) {
  const { profile } = await requireProfile(ctx);

  const teamSpace = await ensureTeamSpace(ctx, profile._id);
  await ensurePersonalSpace(ctx, profile._id, profile.displayName);
  await migrateLegacyBoardData(ctx, teamSpace._id, profile);

  const allProfiles = await ctx.db.query("profiles").collect();
  for (const item of allProfiles) {
    const personal = await ensurePersonalSpace(ctx, item._id, item.displayName);
    await ensureDefaultColumnsForSpace(ctx, personal._id);
  }

  const spaces = await listAccessibleSpaces(ctx, profile._id);
  for (const space of spaces) {
    await ensureDefaultColumnsForSpace(ctx, space._id);
  }

  return {
    profileId: profile._id,
    teamSpaceId: teamSpace._id,
  };
}

export const ensureBoardSetup = mutation({
  args: {},
  handler: async (ctx) => {
    return await ensureBoardSetupForCurrentUser(ctx);
  },
});

export const listSpaces = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    const spaces = await listAccessibleSpaces(ctx, profile._id);

    return spaces.map((space) => ({
      ...space,
      label:
        space.kind === "personal" && space.ownerId === profile._id
          ? "Personnel"
          : space.kind === "team"
            ? "Équipe"
            : space.name,
    }));
  },
});

export const createSpace = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    visibility: v.union(v.literal("private"), v.literal("shared")),
    memberIds: v.optional(v.array(v.id("profiles"))),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);

    const name = args.name.trim();
    if (!name) {
      throw new Error("Le nom de l'espace est requis");
    }

    const now = Date.now();
    const spaceId = await ctx.db.insert("spaces", {
      name,
      description: args.description?.trim() || undefined,
      color: args.color?.trim() || undefined,
      visibility: args.visibility,
      kind: "custom",
      ownerId: profile._id,
      createdAt: now,
      updatedAt: now,
    });

    await addMembersToSpace(ctx, spaceId, profile._id, args.memberIds ?? []);
    await ensureDefaultColumnsForSpace(ctx, spaceId);

    const created = await ctx.db.get(spaceId);
    if (!created) {
      throw new Error("Impossible de créer l'espace");
    }

    return created;
  },
});

export const getBoardData = query({
  args: {
    spaceId: v.id("spaces"),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    await assertSpaceAccess(ctx, args.spaceId, profile._id);

    const columns = await ctx.db
      .query("boardColumns")
      .withIndex("by_space_order", (q) => q.eq("spaceId", args.spaceId))
      .collect();

    columns.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a._creationTime - b._creationTime;
    });

    const instances = await ctx.db
      .query("boardCardInstances")
      .withIndex("by_space_order", (q) => q.eq("spaceId", args.spaceId))
      .collect();

    const cards = await Promise.all(instances.map((instance) => ctx.db.get(instance.cardId)));
    const taskById = new Map(cards.filter((task): task is NonNullable<typeof task> => !!task).map((task) => [task._id, task]));

    const tasks = instances
      .map((instance) => {
        const card = taskById.get(instance.cardId);
        if (!card) return null;
        return {
          ...card,
          instanceId: instance._id,
          cardId: card._id,
          columnId: instance.columnId,
          order: instance.order,
          instanceCreatedAt: instance.createdAt,
          instanceUpdatedAt: instance.updatedAt,
        };
      })
      .filter((task): task is NonNullable<typeof task> => !!task)
      .sort((a, b) => {
        if (a.columnId !== b.columnId) {
          return String(a.columnId).localeCompare(String(b.columnId));
        }
        if (a.order !== b.order) {
          return a.order - b.order;
        }
        return a._creationTime - b._creationTime;
      });

    return {
      columns,
      tasks,
      now: Date.now(),
    };
  },
});

export const updateBoardColumn = mutation({
  args: {
    spaceId: v.id("spaces"),
    columnId: v.id("boardColumns"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    await assertSpaceAccess(ctx, args.spaceId, profile._id);
    await assertColumnExistsInSpace(ctx, args.columnId, args.spaceId);

    const nextName = args.name.trim();
    if (!nextName) {
      throw new Error("Le nom de colonne est requis");
    }

    await ctx.db.patch(args.columnId, {
      name: nextName,
    });

    const updated = await ctx.db.get(args.columnId);
    if (!updated) {
      throw new Error("Impossible de charger la colonne mise à jour");
    }
    return updated;
  },
});

export const batchUpdateColumnOrders = mutation({
  args: {
    spaceId: v.id("spaces"),
    updates: v.array(
      v.object({
        columnId: v.id("boardColumns"),
        order: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    await assertSpaceAccess(ctx, args.spaceId, profile._id);

    for (const update of args.updates) {
      await assertColumnExistsInSpace(ctx, update.columnId, args.spaceId);
    }

    for (const update of args.updates) {
      await ctx.db.patch(update.columnId, {
        order: update.order,
      });
    }

    return { updatedCount: args.updates.length };
  },
});

export const createBoardTask = mutation({
  args: {
    spaceId: v.id("spaces"),
    title: v.string(),
    columnId: v.id("boardColumns"),
    order: v.number(),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("urgent"), v.literal("high"), v.literal("medium"), v.literal("low"))),
    assigneeProfileIds: v.optional(v.array(v.id("profiles"))),
    tags: v.optional(v.array(v.string())),
    checklist: v.optional(
      v.array(
        v.object({
          id: v.string(),
          text: v.string(),
          done: v.boolean(),
        }),
      ),
    ),
    commentsCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);

    await assertSpaceAccess(ctx, args.spaceId, profile._id);
    await assertColumnExistsInSpace(ctx, args.columnId, args.spaceId);

    const nextAssigneeIds = normalizeAssigneeProfileIds(profile._id, args.assigneeProfileIds);
    if (profile.role === "stagiaire" && !areAllInAccessScope(accessProfileIds, nextAssigneeIds)) {
      throw new Error("Non autorisé");
    }

    const now = Date.now();
    const cardId = await ctx.db.insert("tasks", {
      title: args.title,
      type: "exception",
      boardCard: true,
      description: args.description,
      note: args.notes,
      notes: args.notes,
      priority: args.priority ?? "medium",
      status: "todo",
      date: args.dueDate ?? todayIsoDate(),
      dueDate: args.dueDate,
      startTime: "09:00",
      endTime: "10:00",
      assigneeProfileId: nextAssigneeIds[0] ?? profile._id,
      assigneeProfileIds: nextAssigneeIds,
      tags: normalizeTags(args.tags),
      createdByProfileId: profile._id,
      createdAt: now,
      updatedAt: now,
      period: "none",
      entryType: "task",
      checklist: normalizeChecklistItems(args.checklist),
      commentsCount: args.commentsCount ?? 0,
      calendarFilterIds: [],
      isRecurringInstance: false,
    });

    const instanceId = await ctx.db.insert("boardCardInstances", {
      spaceId: args.spaceId,
      cardId,
      columnId: args.columnId,
      order: args.order,
      createdAt: now,
      updatedAt: now,
    });

    const createdCard = await ctx.db.get(cardId);
    if (!createdCard) {
      throw new Error("Impossible de créer la carte");
    }

    return {
      ...createdCard,
      cardId,
      instanceId,
      columnId: args.columnId,
      order: args.order,
    };
  },
});

export const batchUpdatePositions = mutation({
  args: {
    spaceId: v.id("spaces"),
    updates: v.array(
      v.object({
        instanceId: v.id("boardCardInstances"),
        columnId: v.id("boardColumns"),
        order: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    await assertSpaceAccess(ctx, args.spaceId, profile._id);

    for (const update of args.updates) {
      await assertColumnExistsInSpace(ctx, update.columnId, args.spaceId);
      const instance = await ctx.db.get(update.instanceId);
      if (!instance) {
        throw new Error("Carte introuvable");
      }
      if (instance.spaceId !== args.spaceId) {
        throw new Error("Cette carte n'appartient pas à l'espace sélectionné");
      }
    }

    const now = Date.now();
    for (const update of args.updates) {
      await ctx.db.patch(update.instanceId, {
        columnId: update.columnId,
        order: update.order,
        updatedAt: now,
      });
    }

    return { updatedCount: args.updates.length };
  },
});

export const updateBoardTaskDetails = mutation({
  args: {
    spaceId: v.id("spaces"),
    cardId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    notes: v.optional(v.union(v.string(), v.null())),
    dueDate: v.optional(v.union(v.string(), v.null())),
    priority: v.optional(v.union(v.literal("urgent"), v.literal("high"), v.literal("medium"), v.literal("low"))),
    assigneeProfileIds: v.optional(v.array(v.id("profiles"))),
    tags: v.optional(v.array(v.string())),
    checklist: v.optional(
      v.array(
        v.object({
          id: v.string(),
          text: v.string(),
          done: v.boolean(),
        }),
      ),
    ),
    commentsCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    await assertSpaceAccess(ctx, args.spaceId, profile._id);

    const instance = await ctx.db
      .query("boardCardInstances")
      .withIndex("by_space_card", (q) => q.eq("spaceId", args.spaceId).eq("cardId", args.cardId))
      .first();
    if (!instance) {
      throw new Error("Carte introuvable dans cet espace");
    }

    const card = await ctx.db.get(args.cardId);
    if (!card) throw new Error("Tâche introuvable");

    const nextAssigneeIds = args.assigneeProfileIds
      ? normalizeAssigneeProfileIds(card.assigneeProfileId, args.assigneeProfileIds)
      : card.assigneeProfileIds ?? [card.assigneeProfileId];

    if (profile.role === "stagiaire" && !areAllInAccessScope(accessProfileIds, nextAssigneeIds)) {
      throw new Error("Non autorisé");
    }

    await ctx.db.patch(args.cardId, {
      title: args.title ?? card.title,
      description:
        args.description === undefined
          ? card.description
          : args.description ?? undefined,
      note:
        args.notes === undefined
          ? card.note
          : args.notes ?? undefined,
      notes:
        args.notes === undefined
          ? card.notes ?? card.note
          : args.notes ?? undefined,
      dueDate:
        args.dueDate === undefined
          ? card.dueDate
          : args.dueDate ?? undefined,
      date:
        args.dueDate === undefined
          ? card.date
          : args.dueDate ?? card.date,
      priority: args.priority ?? card.priority,
      assigneeProfileId: nextAssigneeIds[0] ?? card.assigneeProfileId,
      assigneeProfileIds: nextAssigneeIds,
      tags: args.tags ? normalizeTags(args.tags) : card.tags,
      checklist: args.checklist ? normalizeChecklistItems(args.checklist) : card.checklist,
      commentsCount: args.commentsCount ?? card.commentsCount,
      boardCard: true,
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(args.cardId);
    if (!updated) {
      throw new Error("Impossible de charger la carte mise à jour");
    }

    return updated;
  },
});

export const addChecklistItem = mutation({
  args: {
    spaceId: v.id("spaces"),
    cardId: v.id("tasks"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    await assertSpaceAccess(ctx, args.spaceId, profile._id);

    const instance = await ctx.db
      .query("boardCardInstances")
      .withIndex("by_space_card", (q) => q.eq("spaceId", args.spaceId).eq("cardId", args.cardId))
      .first();
    if (!instance) {
      throw new Error("Carte introuvable dans cet espace");
    }

    const card = await ctx.db.get(args.cardId);
    if (!card) throw new Error("Tâche introuvable");

    const text = args.text.trim();
    if (!text) {
      throw new Error("Le texte de la checklist est requis");
    }

    const checklist = [
      ...(card.checklist ?? []),
      {
        id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label: text,
        text,
        done: false,
      },
    ];

    await ctx.db.patch(args.cardId, { checklist, boardCard: true, updatedAt: Date.now() });
    return checklist;
  },
});

export const toggleChecklistItem = mutation({
  args: {
    spaceId: v.id("spaces"),
    cardId: v.id("tasks"),
    itemId: v.string(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    await assertSpaceAccess(ctx, args.spaceId, profile._id);

    const instance = await ctx.db
      .query("boardCardInstances")
      .withIndex("by_space_card", (q) => q.eq("spaceId", args.spaceId).eq("cardId", args.cardId))
      .first();
    if (!instance) {
      throw new Error("Carte introuvable dans cet espace");
    }

    const card = await ctx.db.get(args.cardId);
    if (!card) throw new Error("Tâche introuvable");

    const checklist = (card.checklist ?? []).map((item) =>
      item.id === args.itemId ? { ...item, done: !item.done } : item,
    );

    await ctx.db.patch(args.cardId, { checklist, boardCard: true, updatedAt: Date.now() });
    return checklist;
  },
});

export const duplicateCard = mutation({
  args: {
    sourceSpaceId: v.id("spaces"),
    targetSpaceId: v.id("spaces"),
    cardId: v.id("tasks"),
    syncWithOriginal: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    await assertSpaceAccess(ctx, args.sourceSpaceId, profile._id);
    await assertSpaceAccess(ctx, args.targetSpaceId, profile._id);

    const sourceInstance = await ctx.db
      .query("boardCardInstances")
      .withIndex("by_space_card", (q) => q.eq("spaceId", args.sourceSpaceId).eq("cardId", args.cardId))
      .first();

    if (!sourceInstance) {
      throw new Error("Carte source introuvable dans l'espace d'origine");
    }

    const existingTargetInstance = await ctx.db
      .query("boardCardInstances")
      .withIndex("by_space_card", (q) => q.eq("spaceId", args.targetSpaceId).eq("cardId", args.cardId))
      .first();

    if (args.syncWithOriginal && existingTargetInstance) {
      throw new Error("Cette carte existe déjà dans l'espace cible");
    }

    const sourceCard = await ctx.db.get(args.cardId);
    if (!sourceCard) {
      throw new Error("Carte source introuvable");
    }

    const targetColumnId = await getDefaultColumnIdForSpace(ctx, args.targetSpaceId);
    const targetInstances = await ctx.db
      .query("boardCardInstances")
      .withIndex("by_space_order", (q) => q.eq("spaceId", args.targetSpaceId))
      .collect();
    const maxOrderInTargetColumn = targetInstances
      .filter((instance) => instance.columnId === targetColumnId)
      .reduce((max, instance) => Math.max(max, instance.order), 0);

    const now = Date.now();

    if (args.syncWithOriginal) {
      const instanceId = await ctx.db.insert("boardCardInstances", {
        spaceId: args.targetSpaceId,
        cardId: args.cardId,
        columnId: targetColumnId,
        order: maxOrderInTargetColumn + 1000,
        createdAt: now,
        updatedAt: now,
      });

      return {
        mode: "synced",
        cardId: args.cardId,
        instanceId,
      };
    }

    const newCardId = await ctx.db.insert("tasks", {
      title: sourceCard.title,
      type: sourceCard.type ?? "exception",
      boardCard: true,
      description: sourceCard.description,
      note: sourceCard.note,
      notes: sourceCard.notes,
      priority: sourceCard.priority,
      status: sourceCard.status,
      date: sourceCard.date,
      dueDate: sourceCard.dueDate,
      startTime: sourceCard.startTime,
      endTime: sourceCard.endTime,
      assigneeProfileId: sourceCard.assigneeProfileId,
      assigneeProfileIds: sourceCard.assigneeProfileIds,
      tags: sourceCard.tags,
      createdByProfileId: profile._id,
      createdAt: now,
      updatedAt: now,
      period: sourceCard.period,
      entryType: sourceCard.entryType,
      checklist: sourceCard.checklist,
      commentsCount: sourceCard.commentsCount,
      calendarFilterIds: sourceCard.calendarFilterIds,
      isRecurringInstance: false,
    });

    const instanceId = await ctx.db.insert("boardCardInstances", {
      spaceId: args.targetSpaceId,
      cardId: newCardId,
      columnId: targetColumnId,
      order: maxOrderInTargetColumn + 1000,
      createdAt: now,
      updatedAt: now,
    });

    return {
      mode: "cloned",
      cardId: newCardId,
      instanceId,
    };
  },
});
