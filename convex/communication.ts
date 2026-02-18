import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import { requireProfile } from "./lib/auth";
import { ensureTemplateTasksForEvent } from "./communicationAutomation";

type IsoDate = `${number}-${string}-${string}`;

function toIsoDate(date: Date): IsoDate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error("Date invalide");
  }
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function addIsoDays(isoDate: string, days: number): IsoDate {
  const d = fromIsoDate(isoDate);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

function isoTodayInParis(): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()) as IsoDate;
}

function endDateForEvent(event: { startDate: string; endDate?: string }) {
  return (event.endDate ?? event.startDate) as IsoDate;
}

function canAccessEvent(
  role: "admin" | "stagiaire",
  profileId: Id<"profiles">,
  event: { ownerProfileId: Id<"profiles">; backupOwnerProfileId?: Id<"profiles"> | undefined },
) {
  if (role === "admin") return true;
  return (
    event.ownerProfileId === profileId ||
    (event.backupOwnerProfileId ? event.backupOwnerProfileId === profileId : false)
  );
}

export const listEditorialEvents = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    const events = await ctx.db.query("editorialEvents").collect();
    const visible = events.filter((event) => canAccessEvent(profile.role, profile._id, event));
    return visible.sort((a, b) => {
      if (a.prepStartDate !== b.prepStartDate) return a.prepStartDate.localeCompare(b.prepStartDate);
      if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
      return a.title.localeCompare(b.title);
    });
  },
});

export const listEditorialEventsInRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    category: v.optional(v.union(v.literal("marronnier"), v.literal("soldes"), v.literal("interne"))),
    ownerProfileId: v.optional(v.id("profiles")),
    status: v.optional(
      v.union(
        v.literal("a_preparer"),
        v.literal("en_creation"),
        v.literal("programme"),
        v.literal("publie"),
        v.literal("rex"),
      ),
    ),
    priority: v.optional(v.union(v.literal("faible"), v.literal("moyen"), v.literal("eleve"))),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);

    const candidates = await ctx.db
      .query("editorialEvents")
      .withIndex("by_startDate", (q) => q.lte("startDate", args.endDate))
      .collect();

    const overlapped = candidates.filter((event) => {
      const endDate = endDateForEvent(event);
      return endDate >= (args.startDate as IsoDate);
    });

    const visible = overlapped.filter((event) => canAccessEvent(profile.role, profile._id, event));

    const filtered = visible.filter((event) => {
      if (args.category && event.category !== args.category) return false;
      if (args.status && event.status !== args.status) return false;
      if (args.priority && event.priority !== args.priority) return false;
      if (args.ownerProfileId) {
        return event.ownerProfileId === args.ownerProfileId || event.backupOwnerProfileId === args.ownerProfileId;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
      const aEnd = endDateForEvent(a);
      const bEnd = endDateForEvent(b);
      if (aEnd !== bEnd) return aEnd.localeCompare(bEnd);
      return a.title.localeCompare(b.title);
    });
  },
});

export const getEditorialEvent = query({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    try {
      const event = await ctx.db.get(args.eventId as Id<"editorialEvents">);
      if (!event) return null;
      if (!canAccessEvent(profile.role, profile._id, event)) return null;
      return event;
    } catch {
      // Invalid or stale id should not crash the UI.
      return null;
    }
  },
});

export const getEditorialEventWithTasks = query({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    let event: Awaited<ReturnType<typeof ctx.db.get>>;
    try {
      event = await ctx.db.get(args.eventId as Id<"editorialEvents">);
    } catch {
      return null;
    }
    if (!event) return null;
    if (!canAccessEvent(profile.role, profile._id, event)) return null;

    const tasks = await ctx.db
      .query("communicationTasks")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .collect();
    tasks.sort((a, b) => {
      if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return a.title.localeCompare(b.title);
    });

    return { event, tasks };
  },
});

export const createEditorialEvent = mutation({
  args: {
    title: v.string(),
    category: v.union(v.literal("marronnier"), v.literal("soldes"), v.literal("interne")),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    prepStartDate: v.string(),
    priority: v.union(v.literal("faible"), v.literal("moyen"), v.literal("eleve")),
    ownerProfileId: v.id("profiles"),
    backupOwnerProfileId: v.optional(v.id("profiles")),
    status: v.union(
      v.literal("a_preparer"),
      v.literal("en_creation"),
      v.literal("programme"),
      v.literal("publie"),
      v.literal("rex"),
    ),
    notes: v.optional(v.string()),
    autoCreateTemplateTasks: v.boolean(),
    applyTemplateNow: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    if (profile.role === "stagiaire" && args.ownerProfileId !== profile._id) {
      throw new Error("Non autorisé");
    }

    const notes = args.notes?.trim();
    const eventId = await ctx.db.insert("editorialEvents", {
      title: args.title.trim(),
      category: args.category,
      startDate: args.startDate,
      endDate: args.endDate?.trim() || undefined,
      prepStartDate: args.prepStartDate,
      priority: args.priority,
      ownerProfileId: args.ownerProfileId,
      backupOwnerProfileId: args.backupOwnerProfileId,
      status: args.status,
      notes: notes ? notes : undefined,
      autoCreateTemplateTasks: args.autoCreateTemplateTasks,
      templateAppliedAt: undefined,
    });

    let templateResult: { createdCount: number; patchedTemplateAppliedAt: boolean } | null = null;
    if (args.applyTemplateNow) {
      const event = await ctx.db.get(eventId);
      if (!event) throw new Error("Événement introuvable (post-création)");
      templateResult = await ensureTemplateTasksForEvent(ctx, event, profile._id);
    }

    return { eventId, templateResult };
  },
});

export const updateEditorialEvent = mutation({
  args: {
    eventId: v.id("editorialEvents"),
    title: v.optional(v.string()),
    category: v.optional(v.union(v.literal("marronnier"), v.literal("soldes"), v.literal("interne"))),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    prepStartDate: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("faible"), v.literal("moyen"), v.literal("eleve"))),
    ownerProfileId: v.optional(v.id("profiles")),
    backupOwnerProfileId: v.optional(v.id("profiles")),
    status: v.optional(
      v.union(
        v.literal("a_preparer"),
        v.literal("en_creation"),
        v.literal("programme"),
        v.literal("publie"),
        v.literal("rex"),
      ),
    ),
    notes: v.optional(v.string()),
    autoCreateTemplateTasks: v.optional(v.boolean()),
    applyTemplateNow: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Événement introuvable");
    if (!canAccessEvent(profile.role, profile._id, event)) throw new Error("Non autorisé");
    if (profile.role === "stagiaire" && event.ownerProfileId !== profile._id) {
      throw new Error("Non autorisé");
    }

    const nextNotes = args.notes?.trim();

    await ctx.db.patch(args.eventId, {
      title: args.title ? args.title.trim() : event.title,
      category: args.category ?? event.category,
      startDate: args.startDate ?? event.startDate,
      endDate:
        args.endDate !== undefined
          ? args.endDate.trim() || undefined
          : event.endDate,
      prepStartDate: args.prepStartDate ?? event.prepStartDate,
      priority: args.priority ?? event.priority,
      ownerProfileId: args.ownerProfileId ?? event.ownerProfileId,
      backupOwnerProfileId:
        args.backupOwnerProfileId !== undefined
          ? args.backupOwnerProfileId
          : event.backupOwnerProfileId,
      status: args.status ?? event.status,
      notes: args.notes !== undefined ? (nextNotes ? nextNotes : undefined) : event.notes,
      autoCreateTemplateTasks: args.autoCreateTemplateTasks ?? event.autoCreateTemplateTasks,
    });

    let templateResult: { createdCount: number; patchedTemplateAppliedAt: boolean } | null = null;
    if (args.applyTemplateNow) {
      const refreshed = await ctx.db.get(args.eventId);
      if (!refreshed) throw new Error("Événement introuvable (post-update)");
      templateResult = await ensureTemplateTasksForEvent(ctx, refreshed, profile._id);
    }

    return { updatedEventId: args.eventId, templateResult };
  },
});

export const deleteEditorialEvent = mutation({
  args: { eventId: v.id("editorialEvents") },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Événement introuvable");
    if (!canAccessEvent(profile.role, profile._id, event)) throw new Error("Non autorisé");
    if (profile.role === "stagiaire" && event.ownerProfileId !== profile._id) {
      throw new Error("Non autorisé");
    }

    const tasks = await ctx.db
      .query("communicationTasks")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    for (const task of tasks) {
      await ctx.db.delete(task._id);
    }

    await ctx.db.delete(args.eventId);
    return { deletedEventId: args.eventId, deletedTasks: tasks.length };
  },
});

export const listCommunicationTasksForEvent = query({
  args: { eventId: v.id("editorialEvents") },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Événement introuvable");
    if (!canAccessEvent(profile.role, profile._id, event)) throw new Error("Non autorisé");

    const tasks = await ctx.db
      .query("communicationTasks")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    return tasks.sort((a, b) => {
      if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return a.title.localeCompare(b.title);
    });
  },
});

export const createCommunicationTask = mutation({
  args: {
    eventId: v.id("editorialEvents"),
    title: v.string(),
    assigneeProfileId: v.id("profiles"),
    dueDate: v.string(),
    status: v.optional(v.union(v.literal("todo"), v.literal("doing"), v.literal("done"))),
    checklist: v.optional(v.array(v.object({ id: v.string(), label: v.string(), done: v.boolean() }))),
    comments: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Événement introuvable");
    if (!canAccessEvent(profile.role, profile._id, event)) throw new Error("Non autorisé");
    if (profile.role === "stagiaire" && args.assigneeProfileId !== profile._id) {
      throw new Error("Non autorisé");
    }

    const comments = args.comments?.trim();
    const taskId = await ctx.db.insert("communicationTasks", {
      eventId: args.eventId,
      title: args.title.trim(),
      assigneeProfileId: args.assigneeProfileId,
      dueDate: args.dueDate,
      status: args.status ?? "todo",
      checklist: args.checklist ?? [],
      comments: comments ? comments : undefined,
      createdByProfileId: profile._id,
    });
    return taskId;
  },
});

export const updateCommunicationTask = mutation({
  args: {
    taskId: v.id("communicationTasks"),
    title: v.optional(v.string()),
    assigneeProfileId: v.optional(v.id("profiles")),
    dueDate: v.optional(v.string()),
    status: v.optional(v.union(v.literal("todo"), v.literal("doing"), v.literal("done"))),
    checklist: v.optional(v.array(v.object({ id: v.string(), label: v.string(), done: v.boolean() }))),
    comments: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Tâche introuvable");
    if (profile.role === "stagiaire" && task.assigneeProfileId !== profile._id) {
      throw new Error("Non autorisé");
    }

    const comments = args.comments?.trim();

    await ctx.db.patch(args.taskId, {
      title: args.title ? args.title.trim() : task.title,
      assigneeProfileId: args.assigneeProfileId ?? task.assigneeProfileId,
      dueDate: args.dueDate ?? task.dueDate,
      status: args.status ?? task.status,
      checklist: args.checklist ?? task.checklist,
      comments: args.comments !== undefined ? (comments ? comments : undefined) : task.comments,
    });

    return { updatedTaskId: args.taskId };
  },
});

export const deleteCommunicationTask = mutation({
  args: { taskId: v.id("communicationTasks") },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Tâche introuvable");
    if (profile.role === "stagiaire" && task.assigneeProfileId !== profile._id) {
      throw new Error("Non autorisé");
    }

    await ctx.db.delete(args.taskId);
    return { deletedTaskId: args.taskId };
  },
});

export const listOverdueCommunicationTasks = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    const today = isoTodayInParis();

    const source =
      profile.role === "admin"
        ? await ctx.db
            .query("communicationTasks")
            .withIndex("by_dueDate", (q) => q.lt("dueDate", today))
            .collect()
        : await ctx.db
            .query("communicationTasks")
            .withIndex("by_assignee_dueDate", (q) =>
              q.eq("assigneeProfileId", profile._id).lt("dueDate", today),
            )
            .collect();

    return source
      .filter((task) => task.status !== "done")
      .sort((a, b) => {
        if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        return a.title.localeCompare(b.title);
      });
  },
});

export const dashboard = query({
  args: {
    prepWindowDays: v.optional(v.number()),
    upcomingWindowDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);

    const today = isoTodayInParis();
    const prepWindowDays = Math.max(1, Math.min(365, args.prepWindowDays ?? 30));
    const upcomingWindowDays = Math.max(1, Math.min(365, args.upcomingWindowDays ?? 90));

    const prepCutoff = addIsoDays(today, prepWindowDays);
    const upcomingCutoff = addIsoDays(today, upcomingWindowDays);

    const prepCandidates = await ctx.db
      .query("editorialEvents")
      .withIndex("by_prepStartDate", (q) => q.gte("prepStartDate", today).lte("prepStartDate", prepCutoff))
      .collect();
    const prepSoonEvents = prepCandidates
      .filter((event) => canAccessEvent(profile.role, profile._id, event))
      .sort((a, b) => {
        if (a.prepStartDate !== b.prepStartDate) return a.prepStartDate.localeCompare(b.prepStartDate);
        if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
        return a.title.localeCompare(b.title);
      })
      .slice(0, 20);

    const upcomingCandidates = await ctx.db
      .query("editorialEvents")
      .withIndex("by_startDate", (q) => q.gte("startDate", today).lte("startDate", upcomingCutoff))
      .collect();
    const upcomingEvents = upcomingCandidates
      .filter((event) => canAccessEvent(profile.role, profile._id, event))
      .sort((a, b) => {
        if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
        return a.title.localeCompare(b.title);
      })
      .slice(0, 20);

    const overdueTasks = await (async () => {
      const tasks =
        profile.role === "admin"
          ? await ctx.db
              .query("communicationTasks")
              .withIndex("by_dueDate", (q) => q.lt("dueDate", today))
              .collect()
          : await ctx.db
              .query("communicationTasks")
              .withIndex("by_assignee_dueDate", (q) =>
                q.eq("assigneeProfileId", profile._id).lt("dueDate", today),
              )
              .collect();

      const open = tasks.filter((task) => task.status !== "done");
      const enriched = await Promise.all(
        open.slice(0, 30).map(async (task) => {
          const event = await ctx.db.get(task.eventId);
          return {
            ...task,
            eventTitle: event?.title ?? "Événement supprimé",
          };
        }),
      );

      return enriched.sort((a, b) => {
        if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        return a.title.localeCompare(b.title);
      });
    })();

    return {
      today,
      prepWindowDays,
      upcomingWindowDays,
      prepSoonEvents,
      upcomingEvents,
      overdueTasks,
    };
  },
});
