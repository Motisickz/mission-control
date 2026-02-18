import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

type IsoDate = `${number}-${string}-${string}`;

type TemplateTaskTitle =
  | "Brief"
  | "Angles"
  | "Copy"
  | "Visuels"
  | "Validation"
  | "Programmation"
  | "REX";

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

function clampToPrepStart(dueDate: IsoDate, prepStartDate: IsoDate): IsoDate {
  return dueDate < prepStartDate ? prepStartDate : dueDate;
}

export async function ensureTemplateTasksForEvent(
  ctx: MutationCtx,
  event: Doc<"editorialEvents">,
  createdByProfileId: Id<"profiles">,
) {
  const prepStartDate = event.prepStartDate as IsoDate;
  const startDate = event.startDate as IsoDate;

  const baseSpecs = [
    { title: "Brief", dueDate: prepStartDate },
    { title: "Angles", dueDate: addIsoDays(prepStartDate, 2) },
    { title: "Copy", dueDate: addIsoDays(startDate, -7) },
    { title: "Visuels", dueDate: addIsoDays(startDate, -5) },
    { title: "Validation", dueDate: addIsoDays(startDate, -2) },
    { title: "Programmation", dueDate: addIsoDays(startDate, -1) },
    { title: "REX", dueDate: addIsoDays(startDate, 2) },
  ] satisfies Array<{ title: TemplateTaskTitle; dueDate: IsoDate }>;

  const templateSpecs = baseSpecs.map((spec) => ({
    title: spec.title,
    dueDate: clampToPrepStart(spec.dueDate, prepStartDate),
  }));

  const assigneeProfileId = event.ownerProfileId ?? event.backupOwnerProfileId;
  if (!assigneeProfileId) throw new Error("Aucun owner/backup défini pour assigner les tâches.");

  const existing = await ctx.db
    .query("communicationTasks")
    .withIndex("by_event", (q) => q.eq("eventId", event._id))
    .collect();
  const existingTitles = new Set(existing.map((task) => task.title));

  let createdCount = 0;
  for (const spec of templateSpecs) {
    if (existingTitles.has(spec.title)) continue;
    await ctx.db.insert("communicationTasks", {
      eventId: event._id,
      title: spec.title,
      assigneeProfileId,
      dueDate: spec.dueDate,
      status: "todo",
      checklist: [],
      createdByProfileId,
    });
    createdCount += 1;
  }

  const missingCount = templateSpecs.filter((spec) => !existingTitles.has(spec.title)).length;
  const allExistAfter = missingCount === 0 || createdCount === missingCount;

  let patchedTemplateAppliedAt = false;
  if ((createdCount > 0 || allExistAfter) && !event.templateAppliedAt) {
    await ctx.db.patch(event._id, { templateAppliedAt: isoTodayInParis() });
    patchedTemplateAppliedAt = true;
  }

  return { createdCount, patchedTemplateAppliedAt };
}

export const ensurePrepTasksForDueEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = isoTodayInParis();
    const candidates = await ctx.db
      .query("editorialEvents")
      .withIndex("by_prepStartDate", (q) => q.lte("prepStartDate", today))
      .collect();

    let scanned = 0;
    let created = 0;
    let patched = 0;

    for (const event of candidates) {
      scanned += 1;
      if (!event.autoCreateTemplateTasks) continue;

      const result = await ensureTemplateTasksForEvent(ctx, event, event.ownerProfileId);
      created += result.createdCount;
      patched += result.patchedTemplateAppliedAt ? 1 : 0;
    }

    return { today, scanned, created, patched };
  },
});
