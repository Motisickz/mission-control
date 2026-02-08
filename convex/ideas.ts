import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireProfile } from "./lib/auth";

export const createIdea = mutation({
  args: {
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    return await ctx.db.insert("ideas", {
      title: args.title,
      content: args.content,
      authorProfileId: profile._id,
      status: "open",
    });
  },
});

export const listIdeas = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    if (profile.role === "admin") {
      return await ctx.db.query("ideas").collect();
    }
    return await ctx.db
      .query("ideas")
      .withIndex("by_author", (q) => q.eq("authorProfileId", profile._id))
      .collect();
  },
});

export const updateIdea = mutation({
  args: {
    ideaId: v.id("ideas"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("open"), v.literal("in_review"), v.literal("adopted"), v.literal("archived")),
    ),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idée introuvable");

    if (profile.role !== "admin" && idea.authorProfileId !== profile._id) {
      throw new Error("Non autorisé");
    }

    await ctx.db.patch(args.ideaId, {
      title: args.title ?? idea.title,
      content: args.content ?? idea.content,
      status: args.status ?? idea.status,
    });
  },
});
