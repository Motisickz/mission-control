import { action } from "./_generated/server";
import { v } from "convex/values";
import {
  createAccount,
  modifyAccountCredentials,
} from "@convex-dev/auth/server";

const SHARED_CONTACT_IDENTIFIER = "contact@hedayatmusic.com";
const SHARED_CONTACT_VARIANTS = [
  { id: "contact+louise@hedayatmusic.com", displayName: "Louise" },
  { id: "contact+anissa@hedayatmusic.com", displayName: "Anissa" },
];

function normalizeIdentifier(value?: string | null) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export const upsertSharedContactPasswords = action({
  args: {
    identifier: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const identifier = normalizeIdentifier(args.identifier);
    if (identifier !== SHARED_CONTACT_IDENTIFIER) {
      throw new Error("Identifiant non autorisé pour cette action.");
    }

    const password = args.password;
    if (!password || password.length < 8) {
      throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const variant of SHARED_CONTACT_VARIANTS) {
      try {
        await createAccount(ctx, {
          provider: "password",
          account: { id: variant.id, secret: password },
          profile: {
            email: variant.id,
            name: variant.displayName,
          },
        });
        createdCount += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        if (!message.includes("already exists")) {
          throw error;
        }
        await modifyAccountCredentials(ctx, {
          provider: "password",
          account: { id: variant.id, secret: password },
        });
        updatedCount += 1;
      }
    }

    return {
      synced: true,
      createdCount,
      updatedCount,
    };
  },
});
