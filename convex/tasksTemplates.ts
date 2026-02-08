import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireProfile } from "./lib/auth";

export const createDailyTemplate = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.string(),
    endTime: v.string(),
    priority: v.union(v.literal("urgent"), v.literal("medium"), v.literal("low")),
    assigneeProfileId: v.id("profiles"),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    if (profile.role === "stagiaire" && args.assigneeProfileId !== profile._id) {
      throw new Error("Non autorisé");
    }

    return await ctx.db.insert("taskTemplates", {
      title: args.title,
      description: args.description,
      startTime: args.startTime,
      endTime: args.endTime,
      priority: args.priority,
      assigneeProfileId: args.assigneeProfileId,
      createdByProfileId: profile._id,
      active: true,
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
    if (profile.role !== "admin") {
      throw new Error("Action réservée à l'admin");
    }

    const templates = await ctx.db.query("taskTemplates").collect();
    const createdIds = [];

    const start = new Date(args.startDate);
    const end = new Date(args.endDate);

    for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      const date = day.toISOString().slice(0, 10);
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
          description: template.description,
          priority: template.priority,
          status: "todo",
          date,
          startTime: template.startTime,
          endTime: template.endTime,
          assigneeProfileId: template.assigneeProfileId,
          createdByProfileId: template.createdByProfileId,
          period: "daily",
          checklist: [],
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
