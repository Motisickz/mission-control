import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";

async function getProfileByUserId(ctx: QueryCtx | MutationCtx, userId: string) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_auth_user_id", (q) => q.eq("authUserId", userId as never))
    .first();
}

export async function requireProfile(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Authentification requise");
  }
  const profile = await getProfileByUserId(ctx, userId);
  if (!profile) {
    throw new Error("Profil introuvable");
  }
  return { userId, profile };
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const { userId, profile } = await requireProfile(ctx);
  if (profile.role !== "admin") {
    throw new Error("Action réservée à l'admin");
  }
  return { userId, profile };
}
