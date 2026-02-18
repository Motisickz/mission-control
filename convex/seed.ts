import { mutation } from "./_generated/server";
import { requireAdmin } from "./lib/auth";

export const seedDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const profiles = await ctx.db.query("profiles").collect();
    if (profiles.length < 2) {
      return { created: false, reason: "Pas assez de profils pour seed (min 2)." };
    }

    const [admin, member] = profiles;

    const existingIdeas = await ctx.db.query("ideas").collect();
    if (existingIdeas.length > 0) {
      return { created: false, reason: "Seed déjà présent." };
    }

    const filterId = await ctx.db.insert("calendarFilters", {
      name: "Opérations",
      color: "oklch(0.68 0.19 35)",
      ownerProfileId: admin._id,
      isSystem: true,
      criteria: "Équipe opérations",
    });

    await ctx.db.insert("tasks", {
      title: "Vérifier le suivi journalier",
      type: "exception",
      description: "Contrôler l'avancement des tâches prioritaires",
      priority: "urgent",
      status: "in_progress",
      date: new Date().toISOString().slice(0, 10),
      startTime: "09:00",
      endTime: "10:00",
      assigneeProfileId: admin._id,
      assigneeProfileIds: [admin._id],
      createdByProfileId: admin._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      period: "daily",
      checklist: [
        { id: "c1", label: "Lire les notifications", done: true },
        { id: "c2", label: "Vérifier les blocages", done: false },
      ],
      commentsCount: 0,
      tags: [],
      calendarFilterIds: [filterId],
      isRecurringInstance: false,
    });

    await ctx.db.insert("tasks", {
      title: "Préparer reporting hebdomadaire",
      type: "exception",
      description: "Compiler les KPIs missions",
      priority: "medium",
      status: "todo",
      date: new Date().toISOString().slice(0, 10),
      startTime: "14:00",
      endTime: "15:00",
      assigneeProfileId: member._id,
      assigneeProfileIds: [member._id],
      createdByProfileId: admin._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      period: "weekly",
      checklist: [
        { id: "c3", label: "Exporter données", done: false },
        { id: "c4", label: "Écrire synthèse", done: false },
      ],
      commentsCount: 0,
      tags: [],
      calendarFilterIds: [filterId],
      isRecurringInstance: false,
    });

    await ctx.db.insert("ideas", {
      title: "Bloc de priorisation du matin",
      content: "Ajouter un rituel de 15 minutes pour clarifier les urgences quotidiennes.",
      authorProfileId: admin._id,
      status: "in_review",
    });

    await ctx.db.insert("ideas", {
      title: "Template onboarding stagiaire",
      content: "Créer une checklist standard pour les 10 premiers jours.",
      authorProfileId: member._id,
      status: "open",
    });

    return { created: true };
  },
});
