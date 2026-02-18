import { internalMutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

type CleanupSummary = Record<string, number>;

const APP_TABLES_TO_WIPE = [
  "communicationTasks",
  "editorialEventAiSuggestions",
  "editorialEvents",
  "missionSnapshots",
  "notifications",
  "ideas",
  "tasks",
  "boardColumns",
  "taskTemplates",
  "calendarFilters",
] as const;

const AUTH_TABLES_TO_WIPE = [
  "authRefreshTokens",
  "authVerifiers",
  "authVerificationCodes",
  "authRateLimits",
  "authSessions",
] as const;

const normalizeLogin = (value: string) => value.trim().toLowerCase();

async function deleteAllFromTable(
  ctx: MutationCtx,
  tableName: (typeof APP_TABLES_TO_WIPE)[number] | (typeof AUTH_TABLES_TO_WIPE)[number],
) {
  const docs = await ctx.db.query(tableName).collect();
  for (const doc of docs) {
    await ctx.db.delete(doc._id);
  }
  return docs.length;
}

export const resetWorkspaceForOwner = internalMutation({
  args: {
    ownerLogin: v.string(),
    confirm: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.confirm !== "RESET_APP") {
      throw new Error('Confirmation invalide. Utilise "RESET_APP".');
    }

    const ownerLogin = normalizeLogin(args.ownerLogin);
    const ownerUsers = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", ownerLogin))
      .collect();

    if (ownerUsers.length === 0) {
      throw new Error(`Aucun compte auth trouvé pour "${ownerLogin}".`);
    }
    if (ownerUsers.length > 1) {
      throw new Error(`Plusieurs comptes auth trouvés pour "${ownerLogin}".`);
    }

    const ownerUser = ownerUsers[0];

    const ownerAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", ownerUser._id))
      .collect();
    if (ownerAccounts.length === 0) {
      throw new Error(
        `Le compte "${ownerLogin}" n'a pas de provider actif (authAccounts). Nettoyage annulé.`,
      );
    }

    let ownerProfile = await ctx.db
      .query("profiles")
      .withIndex("by_auth_user_id", (q) => q.eq("authUserId", ownerUser._id))
      .first();

    if (!ownerProfile) {
      const createdProfileId = await ctx.db.insert("profiles", {
        authUserId: ownerUser._id,
        email: ownerLogin,
        displayName: ownerUser.name ?? ownerLogin,
        role: "admin",
        timezone: "Europe/Paris",
      });
      ownerProfile = await ctx.db.get(createdProfileId);
    }

    if (!ownerProfile) {
      throw new Error("Impossible de récupérer/créer le profil propriétaire.");
    }

    await ctx.db.patch(ownerProfile._id, {
      email: ownerLogin,
      role: "admin",
    });

    const summary: CleanupSummary = {};

    for (const tableName of APP_TABLES_TO_WIPE) {
      summary[tableName] = await deleteAllFromTable(ctx, tableName);
    }

    const allProfiles = await ctx.db.query("profiles").collect();
    let deletedProfiles = 0;
    for (const profile of allProfiles) {
      if (profile._id !== ownerProfile._id) {
        await ctx.db.delete(profile._id);
        deletedProfiles += 1;
      }
    }
    summary.profiles = deletedProfiles;

    for (const tableName of AUTH_TABLES_TO_WIPE) {
      summary[tableName] = await deleteAllFromTable(ctx, tableName);
    }

    const allAccounts = await ctx.db.query("authAccounts").collect();
    let deletedAccounts = 0;
    const keptAccountIds: Id<"authAccounts">[] = [];
    for (const account of allAccounts) {
      if (account.userId !== ownerUser._id) {
        await ctx.db.delete(account._id);
        deletedAccounts += 1;
      } else {
        keptAccountIds.push(account._id);
      }
    }
    summary.authAccounts = deletedAccounts;

    const allUsers = await ctx.db.query("users").collect();
    let deletedUsers = 0;
    for (const user of allUsers) {
      if (user._id !== ownerUser._id) {
        await ctx.db.delete(user._id);
        deletedUsers += 1;
      }
    }
    summary.users = deletedUsers;

    return {
      ownerUserId: ownerUser._id,
      ownerProfileId: ownerProfile._id,
      ownerLogin,
      ownerKeptAccounts: keptAccountIds.length,
      deleted: summary,
    };
  },
});

export const inspectWorkspaceState = internalMutation({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("profiles").collect();
    const users = await ctx.db.query("users").collect();
    const authAccounts = await ctx.db.query("authAccounts").collect();

    const appCounts: CleanupSummary = {};
    for (const tableName of APP_TABLES_TO_WIPE) {
      appCounts[tableName] = (await ctx.db.query(tableName).collect()).length;
    }

    return {
      profiles: profiles.map((profile) => ({
        id: profile._id,
        authUserId: profile.authUserId,
        email: profile.email,
        displayName: profile.displayName,
        role: profile.role,
      })),
      users: users.map((user) => ({
        id: user._id,
        email: user.email ?? null,
        isAnonymous: user.isAnonymous ?? false,
      })),
      authAccounts: authAccounts.map((account) => ({
        id: account._id,
        userId: account.userId,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      })),
      appCounts,
    };
  },
});
