import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireProfile } from "./lib/auth";

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

    const tasks =
      profile.role === "admin"
        ? await ctx.db.query("tasks").withIndex("by_period", (q) => q.eq("period", args.period)).collect()
        : await ctx.db
            .query("tasks")
            .withIndex("by_assignee", (q) => q.eq("assigneeProfileId", profile._id))
            .collect();

    const filtered = tasks.filter((task) => task.period === args.period);
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
