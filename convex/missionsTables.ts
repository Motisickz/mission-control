import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireProfile } from "./lib/auth";

function ensureMissionsAccess(role: string) {
  if (role !== "admin" && role !== "stagiaire") {
    throw new Error("Non autorisé");
  }
}

export const listShowNoShow = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    ensureMissionsAccess(profile.role);

    const rows = await ctx.db.query("showNoShow").collect();
    return rows.sort((a, b) => b.dateDuRdv.localeCompare(a.dateDuRdv));
  },
});

export const createShowNoShow = mutation({
  args: {
    dateDuRdv: v.optional(v.string()),
    nom: v.optional(v.string()),
    lieuDuRdv: v.optional(v.union(v.literal("studio"), v.literal("zoom"))),
    confirme: v.optional(v.union(v.literal("Oui"), v.literal("Non"))),
    presence: v.optional(
      v.union(v.literal("Show"), v.literal("No Show"), v.literal("Annulé par l'artiste")),
    ),
    vente: v.optional(v.union(v.literal("Oui"), v.literal("Non"), v.literal("Devis envoyé"))),
    typeDeVente: v.optional(v.union(v.literal("Compo/Arrangement"), v.literal("Prise de voix"))),
    commentaires: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    ensureMissionsAccess(profile.role);

    const now = Date.now();
    return await ctx.db.insert("showNoShow", {
      dateDuRdv: args.dateDuRdv ?? "",
      nom: args.nom ?? "",
      lieuDuRdv: args.lieuDuRdv ?? "studio",
      confirme: args.confirme ?? "Non",
      presence: args.presence ?? "Show",
      vente: args.vente ?? "Non",
      typeDeVente: args.typeDeVente ?? "Compo/Arrangement",
      commentaires: args.commentaires ?? "",
      createdAt: now,
      updatedAt: now,
      createdBy: profile._id,
    });
  },
});

export const updateShowNoShow = mutation({
  args: {
    rowId: v.id("showNoShow"),
    dateDuRdv: v.optional(v.string()),
    nom: v.optional(v.string()),
    lieuDuRdv: v.optional(v.union(v.literal("studio"), v.literal("zoom"))),
    confirme: v.optional(v.union(v.literal("Oui"), v.literal("Non"))),
    presence: v.optional(
      v.union(v.literal("Show"), v.literal("No Show"), v.literal("Annulé par l'artiste")),
    ),
    vente: v.optional(v.union(v.literal("Oui"), v.literal("Non"), v.literal("Devis envoyé"))),
    typeDeVente: v.optional(v.union(v.literal("Compo/Arrangement"), v.literal("Prise de voix"))),
    commentaires: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    ensureMissionsAccess(profile.role);

    const row = await ctx.db.get(args.rowId);
    if (!row) {
      throw new Error("Ligne introuvable");
    }

    await ctx.db.patch(args.rowId, {
      dateDuRdv: args.dateDuRdv ?? row.dateDuRdv,
      nom: args.nom ?? row.nom,
      lieuDuRdv: args.lieuDuRdv ?? row.lieuDuRdv,
      confirme: args.confirme ?? row.confirme,
      presence: args.presence ?? row.presence,
      vente: args.vente ?? row.vente,
      typeDeVente: args.typeDeVente ?? row.typeDeVente,
      commentaires: args.commentaires ?? row.commentaires,
      updatedAt: Date.now(),
    });
  },
});

export const deleteShowNoShow = mutation({
  args: { rowId: v.id("showNoShow") },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    ensureMissionsAccess(profile.role);

    const row = await ctx.db.get(args.rowId);
    if (!row) {
      throw new Error("Ligne introuvable");
    }

    await ctx.db.delete(args.rowId);
    return { deletedRowId: args.rowId };
  },
});

export const listMissedCalls = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    ensureMissionsAccess(profile.role);

    const rows = await ctx.db.query("missedCalls").collect();
    return rows.sort((a, b) => b.dateEtHoraireAppelManque.localeCompare(a.dateEtHoraireAppelManque));
  },
});

export const createMissedCall = mutation({
  args: {
    dateEtHoraireAppelManque: v.optional(v.string()),
    numeroDeTel: v.optional(v.string()),
    contactHubspot: v.optional(v.string()),
    messageVocal: v.optional(v.boolean()),
    rappele1foisAsap: v.optional(v.boolean()),
    rappele2foisJ1: v.optional(v.boolean()),
    commentaires: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    ensureMissionsAccess(profile.role);

    const now = Date.now();
    return await ctx.db.insert("missedCalls", {
      dateEtHoraireAppelManque: args.dateEtHoraireAppelManque ?? "",
      numeroDeTel: args.numeroDeTel ?? "",
      contactHubspot: args.contactHubspot ?? "",
      messageVocal: args.messageVocal ?? false,
      rappele1foisAsap: args.rappele1foisAsap ?? false,
      rappele2foisJ1: args.rappele2foisJ1 ?? false,
      commentaires: args.commentaires ?? "",
      createdAt: now,
      updatedAt: now,
      createdBy: profile._id,
    });
  },
});

export const updateMissedCall = mutation({
  args: {
    rowId: v.id("missedCalls"),
    dateEtHoraireAppelManque: v.optional(v.string()),
    numeroDeTel: v.optional(v.string()),
    contactHubspot: v.optional(v.string()),
    messageVocal: v.optional(v.boolean()),
    rappele1foisAsap: v.optional(v.boolean()),
    rappele2foisJ1: v.optional(v.boolean()),
    commentaires: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    ensureMissionsAccess(profile.role);

    const row = await ctx.db.get(args.rowId);
    if (!row) {
      throw new Error("Ligne introuvable");
    }

    await ctx.db.patch(args.rowId, {
      dateEtHoraireAppelManque: args.dateEtHoraireAppelManque ?? row.dateEtHoraireAppelManque,
      numeroDeTel: args.numeroDeTel ?? row.numeroDeTel,
      contactHubspot: args.contactHubspot ?? row.contactHubspot,
      messageVocal: args.messageVocal ?? row.messageVocal,
      rappele1foisAsap: args.rappele1foisAsap ?? row.rappele1foisAsap,
      rappele2foisJ1: args.rappele2foisJ1 ?? row.rappele2foisJ1,
      commentaires: args.commentaires ?? row.commentaires,
      updatedAt: Date.now(),
    });
  },
});

export const deleteMissedCall = mutation({
  args: { rowId: v.id("missedCalls") },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    ensureMissionsAccess(profile.role);

    const row = await ctx.db.get(args.rowId);
    if (!row) {
      throw new Error("Ligne introuvable");
    }

    await ctx.db.delete(args.rowId);
    return { deletedRowId: args.rowId };
  },
});
