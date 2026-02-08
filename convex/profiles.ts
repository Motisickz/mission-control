import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireProfile } from "./lib/auth";

export const ensureCurrentProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentification requise");

    const authUser = await ctx.db.get(userId);
    if (!authUser) throw new Error("Utilisateur absent");

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_auth_user_id", (q) => q.eq("authUserId", userId))
      .first();

    if (existing) return existing;

    const count = (await ctx.db.query("profiles").collect()).length;
    const role = count === 0 ? "admin" : "stagiaire";

    const profileId = await ctx.db.insert("profiles", {
      authUserId: userId,
      email: authUser.email ?? "",
      displayName: args.displayName ?? authUser.name ?? authUser.email ?? "Utilisateur",
      role,
      timezone: "Europe/Paris",
    });

    return await ctx.db.get(profileId);
  },
});

export const getCurrentProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("profiles")
      .withIndex("by_auth_user_id", (q) => q.eq("authUserId", userId))
      .first();
  },
});

export const listVisibleProfiles = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    if (profile.role === "admin") {
      return await ctx.db.query("profiles").collect();
    }
    return [profile];
  },
});

export const updateMyDisplayName = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    await ctx.db.patch(profile._id, { displayName: args.displayName });
  },
});
