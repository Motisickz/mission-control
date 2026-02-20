import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const DEFAULT_BOARD_COLUMNS = [
  { name: "Backlog", order: 1000 },
  { name: "À faire", order: 2000 },
  { name: "En cours", order: 3000 },
  { name: "En attente", order: 4000 },
  { name: "Terminé", order: 5000 },
] as const;

export type SpaceAccessRole = "owner" | "member";

type DbCtx = QueryCtx | MutationCtx;

type WriteCtx = MutationCtx;

type SpaceDoc = Doc<"spaces">;

function normalizeString(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function ensureSpaceMember(
  ctx: WriteCtx,
  spaceId: Id<"spaces">,
  userId: Id<"profiles">,
  roleInSpace: SpaceAccessRole,
) {
  const existing = await ctx.db
    .query("spaceMembers")
    .withIndex("by_user_space", (q) => q.eq("userId", userId).eq("spaceId", spaceId))
    .first();

  if (existing) {
    if (existing.roleInSpace !== roleInSpace) {
      await ctx.db.patch(existing._id, { roleInSpace });
    }
    return existing;
  }

  const memberId = await ctx.db.insert("spaceMembers", {
    spaceId,
    userId,
    roleInSpace,
    createdAt: Date.now(),
  });

  return await ctx.db.get(memberId);
}

export async function ensureDefaultColumnsForSpace(ctx: WriteCtx, spaceId: Id<"spaces">) {
  const existing = await ctx.db
    .query("boardColumns")
    .withIndex("by_space_order", (q) => q.eq("spaceId", spaceId))
    .collect();

  if (existing.length > 0) {
    return existing;
  }

  for (const column of DEFAULT_BOARD_COLUMNS) {
    await ctx.db.insert("boardColumns", {
      spaceId,
      name: column.name,
      order: column.order,
    });
  }

  return await ctx.db
    .query("boardColumns")
    .withIndex("by_space_order", (q) => q.eq("spaceId", spaceId))
    .collect();
}

export async function ensureTeamSpace(ctx: WriteCtx, ownerId: Id<"profiles">) {
  const existing = await ctx.db
    .query("spaces")
    .withIndex("by_kind", (q) => q.eq("kind", "team"))
    .first();

  if (existing) {
    await ensureSpaceMember(ctx, existing._id, ownerId, existing.ownerId === ownerId ? "owner" : "member");
    return existing;
  }

  const now = Date.now();
  const spaceId = await ctx.db.insert("spaces", {
    name: "Équipe",
    description: "Board partagé de l'équipe",
    color: "#2563EB",
    visibility: "shared",
    kind: "team",
    ownerId,
    createdAt: now,
    updatedAt: now,
  });

  await ensureSpaceMember(ctx, spaceId, ownerId, "owner");
  const created = await ctx.db.get(spaceId);
  if (!created) {
    throw new Error("Impossible de créer l'espace équipe");
  }
  return created;
}

export async function ensurePersonalSpace(ctx: WriteCtx, profileId: Id<"profiles">, displayName?: string) {
  const existing = await ctx.db
    .query("spaces")
    .withIndex("by_owner_kind", (q) => q.eq("ownerId", profileId).eq("kind", "personal"))
    .first();

  if (existing) {
    await ensureSpaceMember(ctx, existing._id, profileId, "owner");
    return existing;
  }

  const ownerLabel = normalizeString(displayName) || "Moi";
  const now = Date.now();
  const spaceId = await ctx.db.insert("spaces", {
    name: `Personnel (${ownerLabel})`,
    description: "Espace privé personnel",
    color: "#0EA5E9",
    visibility: "private",
    kind: "personal",
    ownerId: profileId,
    createdAt: now,
    updatedAt: now,
  });

  await ensureSpaceMember(ctx, spaceId, profileId, "owner");
  const created = await ctx.db.get(spaceId);
  if (!created) {
    throw new Error("Impossible de créer l'espace personnel");
  }
  return created;
}

export async function listAccessibleSpaces(ctx: DbCtx, profileId: Id<"profiles">) {
  const allSpaces = await ctx.db.query("spaces").collect();
  const memberships = await ctx.db
    .query("spaceMembers")
    .withIndex("by_user_space", (q) => q.eq("userId", profileId))
    .collect();

  const memberSpaceIds = new Set(memberships.map((member) => member.spaceId));

  const accessible = allSpaces.filter((space) => {
    if (space.kind === "team") return true;
    if (space.ownerId === profileId) return true;
    return memberSpaceIds.has(space._id);
  });

  accessible.sort((a, b) => {
    const rank = (space: SpaceDoc) => {
      if (space.kind === "personal" && space.ownerId === profileId) return 0;
      if (space.kind === "team") return 1;
      return 2;
    };
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name, "fr");
  });

  return accessible;
}

export async function assertSpaceAccess(ctx: DbCtx, spaceId: Id<"spaces">, profileId: Id<"profiles">) {
  const space = await ctx.db.get(spaceId);
  if (!space) {
    throw new Error("Espace introuvable");
  }

  if (space.kind === "team" || space.ownerId === profileId) {
    return space;
  }

  const member = await ctx.db
    .query("spaceMembers")
    .withIndex("by_user_space", (q) => q.eq("userId", profileId).eq("spaceId", spaceId))
    .first();

  if (!member) {
    throw new Error("Non autorisé à accéder à cet espace");
  }

  return space;
}

export async function addMembersToSpace(
  ctx: WriteCtx,
  spaceId: Id<"spaces">,
  ownerId: Id<"profiles">,
  memberIds: Id<"profiles">[],
) {
  const uniqueMemberIds = new Set<Id<"profiles">>([ownerId, ...memberIds]);

  for (const memberId of uniqueMemberIds) {
    await ensureSpaceMember(ctx, spaceId, memberId, memberId === ownerId ? "owner" : "member");
  }
}
