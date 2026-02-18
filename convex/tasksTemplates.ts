import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireProfile } from "./lib/auth";
import { getAccessProfileIds } from "./lib/sharedProfiles";

const weekdayValidator = v.union(
  v.literal("mon"),
  v.literal("tue"),
  v.literal("wed"),
  v.literal("thu"),
  v.literal("fri"),
  v.literal("sat"),
  v.literal("sun"),
);

function fromIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error("Date invalide");
  }
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTime(value: string) {
  return value.trim().slice(0, 5);
}

function weekdayFromDate(date: Date): "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun" {
  const day = date.getDay();
  if (day === 0) return "sun";
  if (day === 1) return "mon";
  if (day === 2) return "tue";
  if (day === 3) return "wed";
  if (day === 4) return "thu";
  if (day === 5) return "fri";
  return "sat";
}

function isTemplateActiveOnDate(template: { startDate?: string; endDate?: string }, isoDate: string) {
  if (template.startDate && isoDate < template.startDate) return false;
  if (template.endDate && isoDate > template.endDate) return false;
  return true;
}

function ensureDateRange(startDate: string, endDate?: string) {
  if (endDate && endDate < startDate) {
    throw new Error("La date de fin doit être après la date de début.");
  }
}

async function loadTemplatesForAccessScope(
  ctx: QueryCtx | MutationCtx,
  role: "admin" | "stagiaire",
  accessProfileIds: Id<"profiles">[],
) {
  if (role === "admin") {
    return await ctx.db.query("taskTemplates").collect();
  }

  const collected = (
    await Promise.all(
      accessProfileIds.map((profileId) =>
        ctx.db
          .query("taskTemplates")
          .withIndex("by_assignee", (q) => q.eq("assigneeProfileId", profileId))
          .collect(),
      ),
    )
  ).flat();

  const byId = new Map(collected.map((template) => [template._id, template]));
  return [...byId.values()];
}

export const listDailyTemplates = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const source = await loadTemplatesForAccessScope(ctx, profile.role, accessProfileIds);

    return source
      .filter((template) => template.active && template.templateType !== "weekly_reminder")
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  },
});

export const createDailyTemplate = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.string(),
    endTime: v.string(),
    priority: v.union(v.literal("urgent"), v.literal("high"), v.literal("medium"), v.literal("low")),
    assigneeProfileId: v.id("profiles"),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    if (profile.role === "stagiaire" && !accessProfileIds.includes(args.assigneeProfileId)) {
      throw new Error("Non autorisé");
    }

    return await ctx.db.insert("taskTemplates", {
      title: args.title,
      description: args.description,
      startTime: normalizeTime(args.startTime),
      endTime: normalizeTime(args.endTime),
      templateType: "daily_block",
      priority: args.priority,
      assigneeProfileId: args.assigneeProfileId,
      createdByProfileId: profile._id,
      active: true,
    });
  },
});

export const updateDailyTemplate = mutation({
  args: {
    templateId: v.id("taskTemplates"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("urgent"), v.literal("high"), v.literal("medium"), v.literal("low"))),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template introuvable");
    if (profile.role !== "admin" && !accessProfileIds.includes(template.assigneeProfileId)) {
      throw new Error("Non autorisé");
    }

    await ctx.db.patch(args.templateId, {
      title: args.title ?? template.title,
      description: args.description ?? template.description,
      startTime: args.startTime ? normalizeTime(args.startTime) : template.startTime,
      endTime: args.endTime ? normalizeTime(args.endTime) : template.endTime,
      templateType: template.templateType ?? "daily_block",
      weekday: undefined,
      startDate: undefined,
      endDate: undefined,
      priority: args.priority ?? template.priority,
      active: args.active ?? template.active,
    });
  },
});

export const generateInstancesForDateRange = mutation({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const sourceTemplates = await loadTemplatesForAccessScope(ctx, profile.role, accessProfileIds);
    const templates = sourceTemplates.filter(
      (template) => template.active && template.templateType !== "weekly_reminder",
    );
    const createdIds = [];

    const start = fromIsoDate(args.startDate);
    const end = fromIsoDate(args.endDate);

    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const date = toIsoDate(cursor);
      for (const template of templates) {
        if (!template.active) continue;

        const existing = await ctx.db
          .query("tasks")
          .withIndex("by_assignee_date", (q) =>
            q.eq("assigneeProfileId", template.assigneeProfileId).eq("date", date),
          )
          .collect();
        const duplicate = existing.some(
          (task) => task.templateId === template._id && task.title === template.title,
        );
        if (duplicate) continue;

        const id = await ctx.db.insert("tasks", {
          title: template.title,
          type: "routine",
          description: template.description,
          priority: template.priority,
          status: "todo",
          date,
          startTime: template.startTime,
          endTime: template.endTime,
          assigneeProfileId: template.assigneeProfileId,
          assigneeProfileIds: [template.assigneeProfileId],
          createdByProfileId: template.createdByProfileId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          period: "daily",
          entryType: "daily_block",
          checklist: [],
          commentsCount: 0,
          tags: [],
          calendarFilterIds: [],
          isRecurringInstance: true,
          templateId: template._id,
        });
        createdIds.push(id);
      }
    }

    return { createdCount: createdIds.length, createdIds };
  },
});

export const listWeeklyReminderTemplates = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const source = await loadTemplatesForAccessScope(ctx, profile.role, accessProfileIds);

    return source
      .filter((template) => template.templateType === "weekly_reminder")
      .sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        if ((a.weekday ?? "") !== (b.weekday ?? "")) return (a.weekday ?? "").localeCompare(b.weekday ?? "");
        return a.startTime.localeCompare(b.startTime);
      });
  },
});

export const createWeeklyReminderTemplate = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    weekday: weekdayValidator,
    startTime: v.string(),
    endTime: v.string(),
    priority: v.union(v.literal("urgent"), v.literal("high"), v.literal("medium"), v.literal("low")),
    assigneeProfileId: v.id("profiles"),
    startDate: v.string(),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    if (profile.role === "stagiaire" && !accessProfileIds.includes(args.assigneeProfileId)) {
      throw new Error("Non autorisé");
    }
    ensureDateRange(args.startDate, args.endDate);

    return await ctx.db.insert("taskTemplates", {
      title: args.title,
      description: args.description,
      templateType: "weekly_reminder",
      weekday: args.weekday,
      startDate: args.startDate,
      endDate: args.endDate,
      startTime: normalizeTime(args.startTime),
      endTime: normalizeTime(args.endTime),
      priority: args.priority,
      assigneeProfileId: args.assigneeProfileId,
      createdByProfileId: profile._id,
      active: true,
    });
  },
});

export const updateWeeklyReminderTemplate = mutation({
  args: {
    templateId: v.id("taskTemplates"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    weekday: v.optional(weekdayValidator),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("urgent"), v.literal("high"), v.literal("medium"), v.literal("low"))),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template introuvable");
    if (profile.role !== "admin" && !accessProfileIds.includes(template.assigneeProfileId)) {
      throw new Error("Non autorisé");
    }
    if (template.templateType && template.templateType !== "weekly_reminder") {
      throw new Error("Template non compatible avec les rappels hebdomadaires");
    }

    const nextStartDate = args.startDate ?? template.startDate ?? toIsoDate(new Date());
    const nextEndDate = args.endDate === undefined ? template.endDate : args.endDate || undefined;
    ensureDateRange(nextStartDate, nextEndDate);

    await ctx.db.patch(args.templateId, {
      title: args.title ?? template.title,
      description: args.description ?? template.description,
      templateType: "weekly_reminder",
      weekday: args.weekday ?? template.weekday,
      startDate: nextStartDate,
      endDate: nextEndDate,
      startTime: args.startTime ? normalizeTime(args.startTime) : template.startTime,
      endTime: args.endTime ? normalizeTime(args.endTime) : template.endTime,
      priority: args.priority ?? template.priority,
      active: args.active ?? template.active,
    });
  },
});

export const generateWeeklyReminderInstances = mutation({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    ensureDateRange(args.startDate, args.endDate);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const sourceTemplates = await loadTemplatesForAccessScope(ctx, profile.role, accessProfileIds);

    const templates = sourceTemplates.filter(
      (template) => template.templateType === "weekly_reminder" && !!template.weekday,
    );

    const start = fromIsoDate(args.startDate);
    const end = fromIsoDate(args.endDate);
    const createdIds = [];
    const updatedIds = [];
    const deletedIds = [];

    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const isoDate = toIsoDate(cursor);
      const weekday = weekdayFromDate(cursor);

      for (const template of templates) {
        const existing = await ctx.db
          .query("tasks")
          .withIndex("by_assignee_date", (q) =>
            q.eq("assigneeProfileId", template.assigneeProfileId).eq("date", isoDate),
          )
          .collect();
        const recurringInstances = existing.filter(
          (task) =>
            task.templateId === template._id &&
            task.isRecurringInstance &&
            task.period === "weekly",
        );

        const shouldExist =
          !!template.weekday &&
          template.weekday === weekday &&
          template.active &&
          isTemplateActiveOnDate(template, isoDate);

        if (!shouldExist) {
          for (const task of recurringInstances) {
            await ctx.db.delete(task._id);
            deletedIds.push(task._id);
          }
          continue;
        }

        if (recurringInstances.length === 0) {
          const id = await ctx.db.insert("tasks", {
            title: template.title,
            type: "exception",
            description: template.description,
            priority: template.priority,
            status: "todo",
            date: isoDate,
            dueDate: isoDate,
            startTime: template.startTime,
            endTime: template.endTime,
            assigneeProfileId: template.assigneeProfileId,
            assigneeProfileIds: [template.assigneeProfileId],
            createdByProfileId: template.createdByProfileId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            period: "weekly",
            entryType: "task",
            checklist: [],
            commentsCount: 0,
            tags: [],
            calendarFilterIds: [],
            isRecurringInstance: true,
            templateId: template._id,
          });
          createdIds.push(id);
          continue;
        }

        const [canonical, ...duplicates] = recurringInstances;
        for (const duplicate of duplicates) {
          await ctx.db.delete(duplicate._id);
          deletedIds.push(duplicate._id);
        }

        if (!canonical) continue;

        const patch: {
          title?: string;
          description?: string;
          priority?: "urgent" | "high" | "medium" | "low";
          startTime?: string;
          endTime?: string;
          dueDate?: string;
          entryType?: "task";
          updatedAt?: number;
        } = {};

        if (canonical.title !== template.title) patch.title = template.title;
        if ((canonical.description ?? "") !== (template.description ?? "")) {
          patch.description = template.description;
        }
        if (canonical.priority !== template.priority) patch.priority = template.priority;
        if (canonical.startTime !== template.startTime) patch.startTime = template.startTime;
        if (canonical.endTime !== template.endTime) patch.endTime = template.endTime;
        if ((canonical.dueDate ?? "") !== isoDate) patch.dueDate = isoDate;
        if ((canonical.entryType ?? "task") !== "task") patch.entryType = "task";
        patch.updatedAt = Date.now();

        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(canonical._id, patch);
          updatedIds.push(canonical._id);
        }
      }
    }

    return {
      createdCount: createdIds.length,
      updatedCount: updatedIds.length,
      deletedCount: deletedIds.length,
      createdIds,
      updatedIds,
      deletedIds,
    };
  },
});
