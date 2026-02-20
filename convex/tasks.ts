import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireProfile } from "./lib/auth";
import { areAllInAccessScope, getAccessProfileIds, hasProfileAccess } from "./lib/sharedProfiles";

type TaskRole = "admin" | "stagiaire";
type TaskType = "routine" | "exception" | "event";

type ChecklistItem = {
  id: string;
  label: string;
  text?: string;
  done: boolean;
};

function canAccessTask(
  role: TaskRole,
  accessProfileIds: Id<"profiles">[],
  taskAssigneeId: Id<"profiles">,
  taskAssigneeIds?: Id<"profiles">[],
) {
  return hasProfileAccess(role, accessProfileIds, taskAssigneeId, taskAssigneeIds);
}

function inferTaskType(entryType?: "task" | "meeting" | "event" | "daily_block"): TaskType {
  if (entryType === "daily_block") return "routine";
  if (entryType === "meeting" || entryType === "event") return "event";
  return "exception";
}

function normalizeAssigneeProfileIds(
  primaryAssigneeId: Id<"profiles">,
  assigneeIds?: Id<"profiles">[],
) {
  const unique = new Set<Id<"profiles">>([primaryAssigneeId, ...(assigneeIds ?? [])]);
  return [...unique];
}

function normalizeChecklistItems(items?: ChecklistItem[]) {
  return (items ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    text: item.text ?? item.label,
    done: item.done,
  }));
}

function isFixedDailyBlock(task: { entryType?: string; templateId?: string }) {
  return task.entryType === "daily_block" && !!task.templateId;
}

function isBoardCard(task: { type?: string; columnId?: Id<"boardColumns">; boardCard?: boolean }) {
  return !!task.boardCard || (!!task.columnId && (task.type ?? "exception") === "exception");
}

async function loadTasksInDateRange(
  ctx: QueryCtx,
  role: TaskRole,
  accessProfileIds: Id<"profiles">[],
  startDate: string,
  endDate: string,
) {
  if (role === "admin") {
    return await ctx.db
      .query("tasks")
      .withIndex("by_date", (q) => q.gte("date", startDate).lte("date", endDate))
      .collect();
  }

  const primaryAssigneeTasks = (
    await Promise.all(
      accessProfileIds.map((profileId) =>
        ctx.db
          .query("tasks")
          .withIndex("by_assignee_date", (q) =>
            q.eq("assigneeProfileId", profileId).gte("date", startDate).lte("date", endDate),
          )
          .collect(),
      ),
    )
  ).flat();
  const allInRange = await ctx.db
    .query("tasks")
    .withIndex("by_date", (q) => q.gte("date", startDate).lte("date", endDate))
    .collect();

  const byId = new Map(primaryAssigneeTasks.map((task) => [task._id, task]));
  for (const task of allInRange) {
    if (canAccessTask(role, accessProfileIds, task.assigneeProfileId, task.assigneeProfileIds)) {
      byId.set(task._id, task);
    }
  }
  return [...byId.values()];
}

export const createTask = mutation({
  args: {
    title: v.string(),
    type: v.optional(v.union(v.literal("routine"), v.literal("exception"), v.literal("event"))),
    description: v.optional(v.string()),
    note: v.optional(v.string()),
    notes: v.optional(v.string()),
    priority: v.union(v.literal("urgent"), v.literal("high"), v.literal("medium"), v.literal("low")),
    status: v.optional(
      v.union(v.literal("todo"), v.literal("in_progress"), v.literal("blocked"), v.literal("done")),
    ),
    date: v.string(),
    dueDate: v.optional(v.string()),
    startTime: v.string(),
    endTime: v.string(),
    assigneeProfileId: v.id("profiles"),
    assigneeProfileIds: v.optional(v.array(v.id("profiles"))),
    period: v.optional(
      v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("none")),
    ),
    entryType: v.optional(
      v.union(
        v.literal("task"),
        v.literal("meeting"),
        v.literal("event"),
        v.literal("daily_block"),
      ),
    ),
    checklist: v.optional(
      v.array(
        v.object({
          id: v.string(),
          label: v.string(),
          text: v.optional(v.string()),
          done: v.boolean(),
        }),
      ),
    ),
    commentsCount: v.optional(v.number()),
    calendarFilterIds: v.optional(v.array(v.id("calendarFilters"))),
    recurringTemplateId: v.optional(v.id("taskTemplates")),
    columnId: v.optional(v.id("boardColumns")),
    order: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const nextAssigneeIds = normalizeAssigneeProfileIds(args.assigneeProfileId, args.assigneeProfileIds);

    if (profile.role === "stagiaire") {
      if (!accessProfileIds.includes(args.assigneeProfileId)) {
        throw new Error("Non autorisé");
      }
      if (!areAllInAccessScope(accessProfileIds, nextAssigneeIds)) {
        throw new Error("Non autorisé");
      }
    }

    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {
      title: args.title,
      type: args.type ?? inferTaskType(args.entryType),
      description: args.description,
      note: args.note,
      notes: args.notes ?? args.note,
      priority: args.priority,
      status: args.status ?? "todo",
      date: args.date,
      dueDate: args.dueDate,
      startTime: args.startTime,
      endTime: args.endTime,
      assigneeProfileId: args.assigneeProfileId,
      assigneeProfileIds: nextAssigneeIds,
      columnId: args.columnId,
      order: args.order,
      tags: args.tags ?? [],
      createdByProfileId: profile._id,
      createdAt: args.createdAt ?? now,
      updatedAt: now,
      period: args.period ?? "none",
      entryType: args.entryType ?? "task",
      checklist: normalizeChecklistItems(args.checklist),
      commentsCount: args.commentsCount ?? 0,
      calendarFilterIds: args.calendarFilterIds ?? [],
      isRecurringInstance: !!args.recurringTemplateId,
      templateId: args.recurringTemplateId,
    });

    if (!accessProfileIds.includes(args.assigneeProfileId)) {
      await ctx.db.insert("notifications", {
        recipientProfileId: args.assigneeProfileId,
        type: "assigned",
        title: `Nouvelle tâche: ${args.title}`,
      });
    }

    return taskId;
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    type: v.optional(v.union(v.literal("routine"), v.literal("exception"), v.literal("event"))),
    description: v.optional(v.string()),
    note: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("blocked"), v.literal("done"))),
    priority: v.optional(v.union(v.literal("urgent"), v.literal("high"), v.literal("medium"), v.literal("low"))),
    date: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    assigneeProfileId: v.optional(v.id("profiles")),
    assigneeProfileIds: v.optional(v.array(v.id("profiles"))),
    entryType: v.optional(
      v.union(
        v.literal("task"),
        v.literal("meeting"),
        v.literal("event"),
        v.literal("daily_block"),
      ),
    ),
    checklist: v.optional(
      v.array(
        v.object({
          id: v.string(),
          label: v.string(),
          text: v.optional(v.string()),
          done: v.boolean(),
        }),
      ),
    ),
    commentsCount: v.optional(v.number()),
    calendarFilterIds: v.optional(v.array(v.id("calendarFilters"))),
    columnId: v.optional(v.id("boardColumns")),
    order: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Tâche introuvable");

    if (!canAccessTask(profile.role, accessProfileIds, task.assigneeProfileId, task.assigneeProfileIds)) {
      throw new Error("Non autorisé");
    }

    const nextPrimaryAssignee = args.assigneeProfileId ?? task.assigneeProfileId;
    const nextAssigneeIds = normalizeAssigneeProfileIds(nextPrimaryAssignee, args.assigneeProfileIds ?? task.assigneeProfileIds);

    if (profile.role === "stagiaire") {
      if (!accessProfileIds.includes(nextPrimaryAssignee)) {
        throw new Error("Non autorisé");
      }
      if (!areAllInAccessScope(accessProfileIds, nextAssigneeIds)) {
        throw new Error("Non autorisé");
      }
    }

    const previousStatus = task.status;
    const now = Date.now();
    const nextEntryType = args.entryType ?? task.entryType ?? "task";

    await ctx.db.patch(args.taskId, {
      title: args.title ?? task.title,
      type: args.type ?? task.type ?? inferTaskType(nextEntryType),
      description: args.description ?? task.description,
      note: args.note ?? task.note,
      notes: args.notes ?? task.notes ?? args.note ?? task.note,
      status: args.status ?? task.status,
      priority: args.priority ?? task.priority,
      date: args.date ?? task.date,
      dueDate: args.dueDate ?? task.dueDate,
      startTime: args.startTime ?? task.startTime,
      endTime: args.endTime ?? task.endTime,
      assigneeProfileId: nextPrimaryAssignee,
      assigneeProfileIds: nextAssigneeIds,
      entryType: nextEntryType,
      checklist: args.checklist ? normalizeChecklistItems(args.checklist) : task.checklist,
      commentsCount: args.commentsCount ?? task.commentsCount,
      calendarFilterIds: args.calendarFilterIds ?? task.calendarFilterIds,
      columnId: args.columnId ?? task.columnId,
      order: args.order ?? task.order,
      tags: args.tags ?? task.tags,
      updatedAt: now,
    });

    if (args.status && args.status !== previousStatus && !accessProfileIds.includes(nextPrimaryAssignee)) {
      await ctx.db.insert("notifications", {
        recipientProfileId: nextPrimaryAssignee,
        type: "status_changed",
        title: `Statut mis à jour: ${task.title}`,
      });
    }
  },
});

export const deleteTask = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Tâche introuvable");

    if (!canAccessTask(profile.role, accessProfileIds, task.assigneeProfileId, task.assigneeProfileIds)) {
      throw new Error("Non autorisé");
    }

    await ctx.db.delete(args.taskId);
    return { deletedTaskId: args.taskId };
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

    if (!canAccessTask(profile.role, accessProfileIds, task.assigneeProfileId, task.assigneeProfileIds)) {
      throw new Error("Non autorisé");
    }

    const checklist = task.checklist.map((item) =>
      item.id === args.itemId ? { ...item, done: !item.done } : item,
    );
    await ctx.db.patch(args.taskId, { checklist, updatedAt: Date.now() });
    return checklist;
  },
});

export const listByPeriod = query({
  args: {
    period: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const tasks = await ctx.db.query("tasks").withIndex("by_period", (q) => q.eq("period", args.period)).collect();

    return tasks.filter((task) =>
      canAccessTask(profile.role, accessProfileIds, task.assigneeProfileId, task.assigneeProfileIds),
    );
  },
});

export const listCalendarRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    activeFilterIds: v.optional(v.array(v.id("calendarFilters"))),
    includeFixedDailyBlocks: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);

    const source = await loadTasksInDateRange(
      ctx,
      profile.role,
      accessProfileIds,
      args.startDate,
      args.endDate,
    );
    const activeFilterSet = new Set(args.activeFilterIds ?? []);
    const includeFixed = args.includeFixedDailyBlocks ?? true;

    return source
      .filter((task) => {
        if (isBoardCard(task)) {
          return false;
        }
        if (!includeFixed && isFixedDailyBlock(task)) {
          return false;
        }
        if (activeFilterSet.size === 0) {
          return true;
        }
        return task.calendarFilterIds.some((filterId) => activeFilterSet.has(filterId));
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
        return a.title.localeCompare(b.title);
      });
  },
});

export const listCalendarFilterUsage = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const source = await loadTasksInDateRange(
      ctx,
      profile.role,
      accessProfileIds,
      args.startDate,
      args.endDate,
    );

    const usage = new Map<string, number>();
    for (const task of source) {
      if (isBoardCard(task)) continue;
      for (const filterId of task.calendarFilterIds) {
        usage.set(filterId, (usage.get(filterId) ?? 0) + 1);
      }
    }

    return [...usage.entries()].map(([filterId, count]) => ({
      filterId,
      count,
    }));
  },
});
