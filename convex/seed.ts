import { mutation } from "./_generated/server";

export const seedDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("profiles").collect();
    if (profiles.length < 2) {
      return { created: false, reason: "Pas assez de profils pour seed (min 2)." };
    }

    const [admin, member] = profiles;

    const existingIdeas = await ctx.db.query("ideas").collect();
    if (existingIdeas.length > 0) {
      return { created: false, reason: "Seed deja present." };
    }

    const filterId = await ctx.db.insert("calendarFilters", {
      name: "Operations",
      color: "oklch(0.68 0.19 35)",
      ownerProfileId: admin._id,
      isSystem: true,
      criteria: "Equipe Operations",
    });

    await ctx.db.insert("tasks", {
      title: "Verifier le suivi journalier",
      description: "Controler l'avancement des taches prioritaires",
      priority: "urgent",
      status: "in_progress",
      date: new Date().toISOString().slice(0, 10),
      startTime: "09:00",
      endTime: "10:00",
      assigneeProfileId: admin._id,
      createdByProfileId: admin._id,
      period: "daily",
      checklist: [
        { id: "c1", label: "Lire les notifications", done: true },
        { id: "c2", label: "Verifier les blocages", done: false },
      ],
      calendarFilterIds: [filterId],
      isRecurringInstance: false,
    });

    await ctx.db.insert("tasks", {
      title: "Preparer reporting hebdomadaire",
      description: "Compiler les KPIs missions",
      priority: "medium",
      status: "todo",
      date: new Date().toISOString().slice(0, 10),
      startTime: "14:00",
      endTime: "15:00",
      assigneeProfileId: member._id,
      createdByProfileId: admin._id,
      period: "weekly",
      checklist: [
        { id: "c3", label: "Exporter donnees", done: false },
        { id: "c4", label: "Ecrire synthese", done: false },
      ],
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
      content: "Creer une checklist standard pour les 10 premiers jours.",
      authorProfileId: member._id,
      status: "open",
    });

    return { created: true };
  },
});
