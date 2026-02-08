import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireProfile } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    const own = await ctx.db
      .query("calendarFilters")
      .withIndex("by_owner", (q) => q.eq("ownerProfileId", profile._id))
      .collect();
    if (profile.role === "admin") {
      return await ctx.db.query("calendarFilters").collect();
    }
    return own;
  },
});

export const createFilter = mutation({
  args: {
    name: v.string(),
    color: v.string(),
    criteria: v.optional(v.string()),
    isSystem: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    if (args.isSystem) {
      await requireAdmin(ctx);
    }
    return await ctx.db.insert("calendarFilters", {
      name: args.name,
      color: args.color,
      criteria: args.criteria,
      isSystem: args.isSystem ?? false,
      ownerProfileId: profile._id,
    });
  },
});

export const updateFilter = mutation({
  args: {
    filterId: v.id("calendarFilters"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    criteria: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const filter = await ctx.db.get(args.filterId);
    if (!filter) throw new Error("Filtre introuvable");
    if (profile.role !== "admin" && filter.ownerProfileId !== profile._id) {
      throw new Error("Non autorise");
    }
    await ctx.db.patch(args.filterId, {
      name: args.name ?? filter.name,
      color: args.color ?? filter.color,
      criteria: args.criteria ?? filter.criteria,
    });
  },
});
