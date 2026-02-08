import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireProfile } from "./lib/auth";

function canAccessTask(role: "admin" | "stagiaire", profileId: string, taskAssigneeId: string) {
  return role === "admin" || profileId === taskAssigneeId;
}

export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    note: v.optional(v.string()),
    priority: v.union(v.literal("urgent"), v.literal("medium"), v.literal("low")),
    status: v.optional(
      v.union(v.literal("todo"), v.literal("in_progress"), v.literal("blocked"), v.literal("done")),
    ),
    date: v.string(),
    dueDate: v.optional(v.string()),
    startTime: v.string(),
    endTime: v.string(),
    assigneeProfileId: v.id("profiles"),
    period: v.optional(
      v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("none")),
    ),
    checklist: v.optional(v.array(v.object({ id: v.string(), label: v.string(), done: v.boolean() }))),
    calendarFilterIds: v.optional(v.array(v.id("calendarFilters"))),
    recurringTemplateId: v.optional(v.id("taskTemplates")),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    if (profile.role === "stagiaire" && args.assigneeProfileId !== profile._id) {
      throw new Error("Non autorisé");
    }

    const taskId = await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      note: args.note,
      priority: args.priority,
      status: args.status ?? "todo",
      date: args.date,
      dueDate: args.dueDate,
      startTime: args.startTime,
      endTime: args.endTime,
      assigneeProfileId: args.assigneeProfileId,
      createdByProfileId: profile._id,
      period: args.period ?? "none",
      checklist: args.checklist ?? [],
      calendarFilterIds: args.calendarFilterIds ?? [],
      isRecurringInstance: !!args.recurringTemplateId,
      templateId: args.recurringTemplateId,
    });

    if (args.assigneeProfileId !== profile._id) {
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
    description: v.optional(v.string()),
    note: v.optional(v.string()),
    status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("blocked"), v.literal("done"))),
    priority: v.optional(v.union(v.literal("urgent"), v.literal("medium"), v.literal("low"))),
    date: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Tâche introuvable");

    if (!canAccessTask(profile.role, profile._id, task.assigneeProfileId)) {
      throw new Error("Non autorisé");
    }

    const previousStatus = task.status;

    await ctx.db.patch(args.taskId, {
      title: args.title ?? task.title,
      description: args.description ?? task.description,
      note: args.note ?? task.note,
      status: args.status ?? task.status,
      priority: args.priority ?? task.priority,
      date: args.date ?? task.date,
      dueDate: args.dueDate ?? task.dueDate,
      startTime: args.startTime ?? task.startTime,
      endTime: args.endTime ?? task.endTime,
    });

    if (args.status && args.status !== previousStatus && task.assigneeProfileId !== profile._id) {
      await ctx.db.insert("notifications", {
        recipientProfileId: task.assigneeProfileId,
        type: "status_changed",
        title: `Statut mis à jour: ${task.title}`,
      });
    }
  },
});

export const toggleChecklistItem = mutation({
  args: {
    taskId: v.id("tasks"),
    itemId: v.string(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Tâche introuvable");

    if (!canAccessTask(profile.role, profile._id, task.assigneeProfileId)) {
      throw new Error("Non autorisé");
    }

    const checklist = task.checklist.map((item) =>
      item.id === args.itemId ? { ...item, done: !item.done } : item,
    );
    await ctx.db.patch(args.taskId, { checklist });
    return checklist;
  },
});

export const listByPeriod = query({
  args: {
    period: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const tasks =
      profile.role === "admin"
        ? await ctx.db.query("tasks").withIndex("by_period", (q) => q.eq("period", args.period)).collect()
        : await ctx.db
            .query("tasks")
            .withIndex("by_assignee", (q) => q.eq("assigneeProfileId", profile._id))
            .collect();

    return tasks.filter((task) => task.period === args.period);
  },
});

export const listCalendarRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);

    const source =
      profile.role === "admin"
        ? await ctx.db.query("tasks").collect()
        : await ctx.db
            .query("tasks")
            .withIndex("by_assignee", (q) => q.eq("assigneeProfileId", profile._id))
            .collect();

    return source.filter((task) => task.date >= args.startDate && task.date <= args.endDate);
  },
});
