import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireProfile } from "./lib/auth";
import { getAccessProfileIds, hasProfileAccess } from "./lib/sharedProfiles";

function canAccessTask(
  role: "admin" | "stagiaire",
  accessProfileIds: Id<"profiles">[],
  taskAssigneeId: Id<"profiles">,
  taskAssigneeIds?: Id<"profiles">[],
) {
  return hasProfileAccess(role, accessProfileIds, taskAssigneeId, taskAssigneeIds);
}

function toProgress(done: number, total: number) {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

export const missionOverview = query({
  args: {
    period: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);

    const tasks = await ctx.db.query("tasks").withIndex("by_period", (q) => q.eq("period", args.period)).collect();

    const filtered = tasks.filter((task) =>
      canAccessTask(profile.role, accessProfileIds, task.assigneeProfileId, task.assigneeProfileIds),
    );
    const done = filtered.filter((task) => task.status === "done").length;

    return {
      period: args.period,
      total: filtered.length,
      done,
      progress: toProgress(done, filtered.length),
      tasks: filtered,
    };
  },
});
