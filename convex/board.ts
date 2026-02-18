import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireProfile } from "./lib/auth";
import { areAllInAccessScope, getAccessProfileIds, hasProfileAccess } from "./lib/sharedProfiles";

type TaskRole = "admin" | "stagiaire";

const DEFAULT_COLUMNS = [
  { name: "Backlog", order: 1000 },
  { name: "À faire", order: 2000 },
  { name: "En cours", order: 3000 },
  { name: "En attente", order: 4000 },
  { name: "Terminé", order: 5000 },
] as const;

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function canAccessTask(
  role: TaskRole,
  accessProfileIds: Id<"profiles">[],
  taskAssigneeId: Id<"profiles">,
  taskAssigneeIds?: Id<"profiles">[],
) {
  return hasProfileAccess(role, accessProfileIds, taskAssigneeId, taskAssigneeIds);
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

async function assertColumnExists(ctx: MutationCtx | QueryCtx, columnId: Id<"boardColumns">) {
  const column = await ctx.db.get(columnId);
  if (!column) {
    throw new Error("Colonne introuvable");
  }
}

export const ensureDefaultColumns = mutation({
  args: {},
  handler: async (ctx) => {
    await requireProfile(ctx);
    const existing = await ctx.db.query("boardColumns").withIndex("by_order", (q) => q).collect();
    if (existing.length > 0) {
      return existing;
    }

    for (const column of DEFAULT_COLUMNS) {
      await ctx.db.insert("boardColumns", {
        name: column.name,
        order: column.order,
      });
    }

    return await ctx.db.query("boardColumns").withIndex("by_order", (q) => q).collect();
  },
});

export const updateBoardColumn = mutation({
  args: {
    columnId: v.id("boardColumns"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireProfile(ctx);
    const column = await ctx.db.get(args.columnId);
    if (!column) {
      throw new Error("Colonne introuvable");
    }

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
    updates: v.array(
      v.object({
        columnId: v.id("boardColumns"),
        order: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireProfile(ctx);

    for (const update of args.updates) {
      const column = await ctx.db.get(update.columnId);
      if (!column) {
        throw new Error("Colonne introuvable");
      }
    }

    for (const update of args.updates) {
      await ctx.db.patch(update.columnId, {
        order: update.order,
      });
    }

    return { updatedCount: args.updates.length };
  },
});

export const getBoardData = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);

    const columns = await ctx.db.query("boardColumns").withIndex("by_order", (q) => q).collect();
    const exceptionTasks = await ctx.db
      .query("tasks")
      .withIndex("by_type", (q) => q.eq("type", "exception"))
      .collect();

    const tasks = exceptionTasks
      .filter((task) => !!task.columnId)
      .filter((task) => canAccessTask(profile.role, accessProfileIds, task.assigneeProfileId, task.assigneeProfileIds))
      .sort((a, b) => {
        if ((a.columnId ?? "") !== (b.columnId ?? "")) {
          return String(a.columnId ?? "").localeCompare(String(b.columnId ?? ""));
        }
        return (a.order ?? 0) - (b.order ?? 0);
      });

    return {
      columns,
      tasks,
      now: Date.now(),
    };
  },
});

export const createBoardTask = mutation({
  args: {
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
    await assertColumnExists(ctx, args.columnId);

    const nextAssigneeIds = normalizeAssigneeProfileIds(profile._id, args.assigneeProfileIds);
    if (profile.role === "stagiaire" && !areAllInAccessScope(accessProfileIds, nextAssigneeIds)) {
      throw new Error("Non autorisé");
    }

    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {
      title: args.title,
      type: "exception",
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
      columnId: args.columnId,
      order: args.order,
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

    const created = await ctx.db.get(taskId);
    if (!created) {
      throw new Error("Impossible de créer la carte");
    }

    return created;
  },
});

export const updateTaskPosition = mutation({
  args: {
    taskId: v.id("tasks"),
    columnId: v.id("boardColumns"),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    await assertColumnExists(ctx, args.columnId);

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Tâche introuvable");
    if (task.type !== "exception") {
      throw new Error("Seules les cartes du board peuvent être déplacées");
    }
    if (!canAccessTask(profile.role, accessProfileIds, task.assigneeProfileId, task.assigneeProfileIds)) {
      throw new Error("Non autorisé");
    }

    await ctx.db.patch(args.taskId, {
      columnId: args.columnId,
      order: args.order,
      updatedAt: Date.now(),
    });

    return { taskId: args.taskId, columnId: args.columnId, order: args.order };
  },
});

export const batchUpdatePositions = mutation({
  args: {
    updates: v.array(
      v.object({
        taskId: v.id("tasks"),
        columnId: v.id("boardColumns"),
        order: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);

    for (const update of args.updates) {
      await assertColumnExists(ctx, update.columnId);
      const task = await ctx.db.get(update.taskId);
      if (!task) {
        throw new Error("Tâche introuvable");
      }
      if (task.type !== "exception") {
        throw new Error("Seules les cartes du board peuvent être déplacées");
      }
      if (!canAccessTask(profile.role, accessProfileIds, task.assigneeProfileId, task.assigneeProfileIds)) {
        throw new Error("Non autorisé");
      }
    }

    const now = Date.now();
    for (const update of args.updates) {
      await ctx.db.patch(update.taskId, {
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
    taskId: v.id("tasks"),
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
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Tâche introuvable");
    if (task.type !== "exception") {
      throw new Error("Seules les cartes du board peuvent être modifiées ici");
    }
    if (!canAccessTask(profile.role, accessProfileIds, task.assigneeProfileId, task.assigneeProfileIds)) {
      throw new Error("Non autorisé");
    }

    const nextAssigneeIds = args.assigneeProfileIds
      ? normalizeAssigneeProfileIds(task.assigneeProfileId, args.assigneeProfileIds)
      : task.assigneeProfileIds ?? [task.assigneeProfileId];

    if (profile.role === "stagiaire" && !areAllInAccessScope(accessProfileIds, nextAssigneeIds)) {
      throw new Error("Non autorisé");
    }

    await ctx.db.patch(args.taskId, {
      title: args.title ?? task.title,
      description:
        args.description === undefined
          ? task.description
          : args.description ?? undefined,
      note:
        args.notes === undefined
          ? task.note
          : args.notes ?? undefined,
      notes:
        args.notes === undefined
          ? task.notes ?? task.note
          : args.notes ?? undefined,
      dueDate:
        args.dueDate === undefined
          ? task.dueDate
          : args.dueDate ?? undefined,
      date:
        args.dueDate === undefined
          ? task.date
          : args.dueDate ?? task.date,
      priority: args.priority ?? task.priority,
      assigneeProfileId: nextAssigneeIds[0] ?? task.assigneeProfileId,
      assigneeProfileIds: nextAssigneeIds,
      tags: args.tags ? normalizeTags(args.tags) : task.tags,
      checklist: args.checklist ? normalizeChecklistItems(args.checklist) : task.checklist,
      commentsCount: args.commentsCount ?? task.commentsCount,
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(args.taskId);
    if (!updated) {
      throw new Error("Impossible de charger la carte mise à jour");
    }

    return updated;
  },
});

export const addChecklistItem = mutation({
  args: {
    taskId: v.id("tasks"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Tâche introuvable");
    if (task.type !== "exception") {
      throw new Error("Seules les cartes du board peuvent être modifiées ici");
    }
    if (!canAccessTask(profile.role, accessProfileIds, task.assigneeProfileId, task.assigneeProfileIds)) {
      throw new Error("Non autorisé");
    }

    const text = args.text.trim();
    if (!text) {
      throw new Error("Le texte de la checklist est requis");
    }

    const checklist = [
      ...(task.checklist ?? []),
      {
        id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label: text,
        text,
        done: false,
      },
    ];

    await ctx.db.patch(args.taskId, { checklist, updatedAt: Date.now() });
    return checklist;
  },
});

export const toggleChecklistItem = mutation({
  args: {
    taskId: v.id("tasks"),
    itemId: v.string(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Tâche introuvable");
    if (task.type !== "exception") {
      throw new Error("Seules les cartes du board peuvent être modifiées ici");
    }
    if (!canAccessTask(profile.role, accessProfileIds, task.assigneeProfileId, task.assigneeProfileIds)) {
      throw new Error("Non autorisé");
    }

    const checklist = (task.checklist ?? []).map((item) =>
      item.id === args.itemId ? { ...item, done: !item.done } : item,
    );

    await ctx.db.patch(args.taskId, { checklist, updatedAt: Date.now() });
    return checklist;
  },
});
