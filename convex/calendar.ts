import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireProfile } from "./lib/auth";
import { getAccessProfileIds } from "./lib/sharedProfiles";

const FILTER_COLOR_PALETTE = [
  "oklch(0.84 0.1 25)",
  "oklch(0.84 0.1 45)",
  "oklch(0.85 0.09 70)",
  "oklch(0.84 0.1 110)",
  "oklch(0.84 0.1 145)",
  "oklch(0.83 0.1 170)",
  "oklch(0.83 0.1 205)",
  "oklch(0.83 0.1 235)",
  "oklch(0.83 0.1 265)",
  "oklch(0.84 0.1 295)",
  "oklch(0.84 0.1 325)",
  "oklch(0.84 0.1 350)",
] as const;

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

function normalizeColorToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function hashToHue(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 360;
  }
  return hash;
}

function uniqueColorForOwner(
  proposedColor: string,
  existingColors: Set<string>,
  seed: string,
) {
  const normalizedProposed = normalizeColorToken(proposedColor);
  if (!existingColors.has(normalizedProposed)) {
    return proposedColor;
  }

  for (const color of FILTER_COLOR_PALETTE) {
    const normalized = normalizeColorToken(color);
    if (!existingColors.has(normalized)) {
      return color;
    }
  }

  const baseHue = hashToHue(seed);
  for (let i = 0; i < 360; i += 1) {
    const hue = (baseHue + i * 17) % 360;
    const color = `oklch(0.84 0.1 ${hue})`;
    if (!existingColors.has(normalizeColorToken(color))) {
      return color;
    }
  }

  return proposedColor;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    if (profile.role === "admin") {
      return await ctx.db.query("calendarFilters").collect();
    }
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const rows = (
      await Promise.all(
        accessProfileIds.map((profileId) =>
          ctx.db
            .query("calendarFilters")
            .withIndex("by_owner", (q) => q.eq("ownerProfileId", profileId))
            .collect(),
        ),
      )
    ).flat();
    const unique = new Map(rows.map((item) => [item._id, item]));
    return [...unique.values()];
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
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    if (args.isSystem) {
      await requireAdmin(ctx);
    }
    const normalizedName = normalizeFilterName(args.name);
    if (!normalizedName) {
      throw new Error("Nom de filtre invalide.");
    }
    const existingForOwner = (
      await Promise.all(
        accessProfileIds.map((profileId) =>
          ctx.db
            .query("calendarFilters")
            .withIndex("by_owner", (q) => q.eq("ownerProfileId", profileId))
            .collect(),
        ),
      )
    ).flat();
    const duplicate = existingForOwner.some(
      (filter) => normalizeFilterName(filter.name) === normalizedName,
    );
    if (duplicate) {
      throw new Error("Ce filtre existe déjà.");
    }
    const usedColors = new Set(existingForOwner.map((filter) => normalizeColorToken(filter.color)));
    const nextColor = uniqueColorForOwner(args.color, usedColors, `${args.name}:${args.criteria ?? ""}`);

    return await ctx.db.insert("calendarFilters", {
      name: formatFilterName(args.name),
      color: nextColor,
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
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const filter = await ctx.db.get(args.filterId);
    if (!filter) throw new Error("Filtre introuvable");
    if (profile.role !== "admin" && !accessProfileIds.includes(filter.ownerProfileId)) {
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
    let nextColor = filter.color;
    if (args.color !== undefined) {
      const existingForOwner = await ctx.db
        .query("calendarFilters")
        .withIndex("by_owner", (q) => q.eq("ownerProfileId", filter.ownerProfileId))
        .collect();
      const usedColors = new Set(
        existingForOwner
          .filter((item) => item._id !== args.filterId)
          .map((item) => normalizeColorToken(item.color)),
      );
      nextColor = uniqueColorForOwner(args.color, usedColors, `${nextName}:${args.criteria ?? filter.criteria ?? ""}`);
    }

    await ctx.db.patch(args.filterId, {
      name: nextName,
      color: nextColor,
      criteria: args.criteria ?? filter.criteria,
    });
  },
});

export const deleteFilter = mutation({
  args: {
    filterId: v.id("calendarFilters"),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const filter = await ctx.db.get(args.filterId);
    if (!filter) throw new Error("Filtre introuvable");
    if (profile.role !== "admin" && !accessProfileIds.includes(filter.ownerProfileId)) {
      throw new Error("Non autorisé");
    }

    const tasks = await ctx.db.query("tasks").collect();
    const impacted = tasks.filter((task) => task.calendarFilterIds.includes(args.filterId));
    for (const task of impacted) {
      await ctx.db.patch(task._id, {
        calendarFilterIds: task.calendarFilterIds.filter((id) => id !== args.filterId),
      });
    }

    await ctx.db.delete(args.filterId);
    return { removedTaskLinks: impacted.length };
  },
});
