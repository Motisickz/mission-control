import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireProfile } from "./lib/auth";

function normalizeFilterName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function formatFilterName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => {
      const lower = word.toLocaleLowerCase("fr-FR");
      return lower.charAt(0).toLocaleUpperCase("fr-FR") + lower.slice(1);
    })
    .join(" ");
}

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
    const normalizedName = normalizeFilterName(args.name);
    if (!normalizedName) {
      throw new Error("Nom de filtre invalide.");
    }
    const existingForOwner = await ctx.db
      .query("calendarFilters")
      .withIndex("by_owner", (q) => q.eq("ownerProfileId", profile._id))
      .collect();
    const duplicate = existingForOwner.some(
      (filter) => normalizeFilterName(filter.name) === normalizedName,
    );
    if (duplicate) {
      throw new Error("Ce filtre existe déjà.");
    }

    return await ctx.db.insert("calendarFilters", {
      name: formatFilterName(args.name),
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
      throw new Error("Non autorisé");
    }
    let nextName = filter.name;
    if (args.name !== undefined) {
      const normalizedName = normalizeFilterName(args.name);
      if (!normalizedName) {
        throw new Error("Nom de filtre invalide.");
      }
      const existingForOwner = await ctx.db
        .query("calendarFilters")
        .withIndex("by_owner", (q) => q.eq("ownerProfileId", filter.ownerProfileId))
        .collect();
      const duplicate = existingForOwner.some(
        (item) => item._id !== args.filterId && normalizeFilterName(item.name) === normalizedName,
      );
      if (duplicate) {
        throw new Error("Ce filtre existe déjà.");
      }
      nextName = formatFilterName(args.name);
    }

    await ctx.db.patch(args.filterId, {
      name: nextName,
      color: args.color ?? filter.color,
      criteria: args.criteria ?? filter.criteria,
    });
  },
});
