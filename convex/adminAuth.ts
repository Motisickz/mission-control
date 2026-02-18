import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import {
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

export const resetPasswordForEmail = internalAction({
  args: {
    identifier: v.optional(v.string()),
    email: v.optional(v.string()),
    newPassword: v.string(),
    invalidateExistingSessions: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const rawIdentifier = args.identifier ?? args.email;
    if (!rawIdentifier) {
      throw new Error("Identifiant manquant (identifier ou email).");
    }
    const identifier = normalizeIdentifier(rawIdentifier);
    const newPassword = args.newPassword;
    if (!newPassword || newPassword.length < 8) {
      throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
    }

    // Ensures the account exists and returns its userId (useful for session invalidation).
    const { user } = await retrieveAccount(ctx, {
      provider: "password",
      account: { id: identifier },
    });

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: identifier, secret: newPassword },
    });

    if (args.invalidateExistingSessions ?? true) {
      await invalidateSessions(ctx, { userId: user._id });
    }

    return { identifier, userId: user._id };
  },
});
