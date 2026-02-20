import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireProfile } from "./lib/auth";
import { getAccessProfileIds } from "./lib/sharedProfiles";
import { ensureDefaultColumnsForSpace, ensurePersonalSpace, ensureTeamSpace } from "./lib/boardSpaces";

const SHARED_CONTACT_IDENTIFIER = "contact@hedayatmusic.com";
const SHARED_CONTACT_PERSONA_NAMES: Record<string, string> = {
  louise: "Louise",
  anissa: "Anissa",
};
const SHARED_CONTACT_ALIAS_NAMES: Record<string, string> = {
  "contact+louise@hedayatmusic.com": "Louise",
  "contact+anissa@hedayatmusic.com": "Anissa",
};

function resolveProfileIdentity(normalizedLogin?: string) {
  if (!normalizedLogin) {
    return {
      profileIdentifier: undefined,
      displayName: undefined,
      isSharedContactAlias: false,
    };
  }

  const prefix = `${SHARED_CONTACT_IDENTIFIER}#`;
  const aliasPersona = SHARED_CONTACT_ALIAS_NAMES[normalizedLogin];
  if (aliasPersona) {
    return {
      profileIdentifier: SHARED_CONTACT_IDENTIFIER,
      displayName: aliasPersona,
      isSharedContactAlias: true,
    };
  }

  if (!normalizedLogin.startsWith(prefix)) {
    return {
      profileIdentifier: normalizedLogin,
      displayName: normalizedLogin,
      isSharedContactAlias: false,
    };
  }

  const personaKey = normalizedLogin.slice(prefix.length).trim().toLowerCase();
  const personaName = SHARED_CONTACT_PERSONA_NAMES[personaKey] ?? personaKey ?? "Membre";
  return {
    profileIdentifier: SHARED_CONTACT_IDENTIFIER,
    displayName: personaName,
    isSharedContactAlias: true,
  };
}

export const ensureCurrentProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentification requise");

    const authUser = await ctx.db.get(userId);
    if (!authUser) throw new Error("Utilisateur absent");
    const normalizedLogin =
      typeof authUser.email === "string" && authUser.email.trim().length > 0
        ? authUser.email.trim().toLowerCase()
        : undefined;
    const identity = resolveProfileIdentity(normalizedLogin);

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_auth_user_id", (q) => q.eq("authUserId", userId))
      .first();

    if (existing) {
      const nextEmail =
        identity.isSharedContactAlias && identity.profileIdentifier
          ? identity.profileIdentifier
          : existing.email;
      const nextDisplayName =
        args.displayName ??
        (identity.isSharedContactAlias && identity.displayName
          ? identity.displayName
          : existing.displayName);

      if (nextEmail !== existing.email || nextDisplayName !== existing.displayName) {
        await ctx.db.patch(existing._id, {
          email: nextEmail,
          displayName: nextDisplayName,
        });
        const patched = await ctx.db.get(existing._id);
        if (patched) {
          const teamSpace = await ensureTeamSpace(ctx, patched._id);
          const personalSpace = await ensurePersonalSpace(ctx, patched._id, patched.displayName);
          await ensureDefaultColumnsForSpace(ctx, teamSpace._id);
          await ensureDefaultColumnsForSpace(ctx, personalSpace._id);
          return patched;
        }
      }
      const teamSpace = await ensureTeamSpace(ctx, existing._id);
      const personalSpace = await ensurePersonalSpace(ctx, existing._id, existing.displayName);
      await ensureDefaultColumnsForSpace(ctx, teamSpace._id);
      await ensureDefaultColumnsForSpace(ctx, personalSpace._id);
      return existing;
    }

    if (identity.isSharedContactAlias && identity.profileIdentifier && identity.displayName) {
      const existingSharedProfile = await ctx.db
        .query("profiles")
        .filter((q) =>
          q.and(
            q.eq(q.field("email"), identity.profileIdentifier),
            q.eq(q.field("displayName"), identity.displayName),
          ),
        )
        .first();
      if (existingSharedProfile) {
        if (existingSharedProfile.authUserId !== userId) {
          await ctx.db.patch(existingSharedProfile._id, { authUserId: userId });
        }
        const patched = await ctx.db.get(existingSharedProfile._id);
        if (patched) {
          const teamSpace = await ensureTeamSpace(ctx, patched._id);
          const personalSpace = await ensurePersonalSpace(ctx, patched._id, patched.displayName);
          await ensureDefaultColumnsForSpace(ctx, teamSpace._id);
          await ensureDefaultColumnsForSpace(ctx, personalSpace._id);
          return patched;
        }
      }
    }

    const existingAdmin = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();
    const role = existingAdmin ? "stagiaire" : "admin";

    const profileId = await ctx.db.insert("profiles", {
      authUserId: userId,
      email: identity.profileIdentifier ?? normalizedLogin ?? `invite+${userId}@local.invalid`,
      displayName:
        args.displayName ?? identity.displayName ?? authUser.name ?? normalizedLogin ?? "Utilisateur",
      role,
      timezone: "Europe/Paris",
    });

    const created = await ctx.db.get(profileId);
    if (!created) {
      throw new Error("Profil introuvable après création");
    }
    const teamSpace = await ensureTeamSpace(ctx, created._id);
    const personalSpace = await ensurePersonalSpace(ctx, created._id, created.displayName);
    await ensureDefaultColumnsForSpace(ctx, teamSpace._id);
    await ensureDefaultColumnsForSpace(ctx, personalSpace._id);
    return created;
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
    const accessProfileIds = await getAccessProfileIds(ctx, profile);
    const allProfiles = await ctx.db.query("profiles").collect();
    return allProfiles.filter((item) => accessProfileIds.includes(item._id));
  },
});

export const listDirectoryProfiles = query({
  args: {},
  handler: async (ctx) => {
    await requireProfile(ctx);
    const profiles = await ctx.db.query("profiles").collect();
    return profiles.sort((a, b) => {
      if (a.displayName !== b.displayName) {
        return a.displayName.localeCompare(b.displayName, "fr");
      }
      return a.email.localeCompare(b.email, "fr");
    });
  },
});

export const updateMyDisplayName = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    await ctx.db.patch(profile._id, { displayName: args.displayName });
  },
});
