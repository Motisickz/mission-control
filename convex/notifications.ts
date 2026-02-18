import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireProfile } from "./lib/auth";
import { getAccessProfileIds } from "./lib/sharedProfiles";

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const rows = (
      await Promise.all(
        accessProfileIds.map((profileId) =>
          ctx.db
            .query("notifications")
            .withIndex("by_recipient", (q) => q.eq("recipientProfileId", profileId))
            .collect(),
        ),
      )
    ).flat();
    const unique = new Map(rows.map((item) => [item._id, item]));
    return [...unique.values()];
  },
});

export const markRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error("Notification introuvable");
    if (!accessProfileIds.includes(notification.recipientProfileId)) {
      throw new Error("Non autorisé");
    }
    await ctx.db.patch(args.notificationId, { readAt: Date.now() });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const notifications = (
      await Promise.all(
        accessProfileIds.map((profileId) =>
          ctx.db
            .query("notifications")
            .withIndex("by_recipient", (q) => q.eq("recipientProfileId", profileId))
            .collect(),
        ),
      )
    ).flat();

    const unread = notifications.filter((notification) => !notification.readAt);
    await Promise.all(
      unread.map((notification) =>
        ctx.db.patch(notification._id, { readAt: Date.now() }),
      ),
    );

    return { updated: unread.length };
  },
});

export const pushNotification = mutation({
  args: {
    recipientProfileId: v.id("profiles"),
    type: v.union(v.literal("assigned"), v.literal("status_changed"), v.literal("overdue")),
    title: v.string(),
    payload: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    if (profile.role !== "admin" && !accessProfileIds.includes(args.recipientProfileId)) {
      throw new Error("Non autorisé");
    }

    const recipient = await ctx.db.get(args.recipientProfileId);
    if (!recipient) {
      throw new Error("Destinataire introuvable");
    }

    const title = args.title.trim();
    if (!title) {
      throw new Error("Titre obligatoire");
    }

    const payload = args.payload?.trim();

    return await ctx.db.insert("notifications", {
      recipientProfileId: args.recipientProfileId,
      type: args.type,
      title,
      payload: payload || undefined,
    });
  },
});
