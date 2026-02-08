import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireProfile } from "./lib/auth";

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    return await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientProfileId", profile._id))
      .collect();
  },
});

export const markRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error("Notification introuvable");
    if (notification.recipientProfileId !== profile._id) {
      throw new Error("Non autorise");
    }
    await ctx.db.patch(args.notificationId, { readAt: Date.now() });
  },
});
