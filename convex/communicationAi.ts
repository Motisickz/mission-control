import { action, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import { requireProfile } from "./lib/auth";

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

function nowMs() {
  return Date.now();
}

function minutesAgoMs(minutes: number) {
  return nowMs() - minutes * 60 * 1000;
}

function stripJsonFences(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    // Remove ```json ... ``` wrappers if present.
    const withoutStart = trimmed.replace(/^```[a-zA-Z]*\n?/, "");
    return withoutStart.replace(/```$/, "").trim();
  }
  return trimmed;
}

function buildInputSummary(event: {
  title: string;
  category: string;
  prepStartDate: string;
  startDate: string;
  endDate?: string | undefined;
  notes?: string | undefined;
}) {
  const end = event.endDate ? ` -> ${event.endDate}` : "";
  const notes = event.notes ? ` Notes: ${event.notes.slice(0, 240)}` : "";
  return `${event.title} (${event.category}) Prep ${event.prepStartDate} | Post ${event.startDate}${end}.${notes}`.trim();
}

function buildPrompt(event: {
  title: string;
  category: string;
  prepStartDate: string;
  startDate: string;
  endDate?: string | undefined;
  notes?: string | undefined;
}) {
  const constraints = [
    "Tu es un expert social media FR pour un studio d'enregistrement.",
    "Tu dois renvoyer UNIQUEMENT du JSON valide (pas de Markdown, pas de texte).",
    "Le JSON doit respecter exactement la forme demandee (cles presentes, types corrects).",
    "Contenu actionnable, concret, et oriente prise de contact / reservation.",
    "Idees adaptees: booking, avant/apres, coulisses, artistes, equipements, preuves sociales, making-of, tips audio, erreurs a eviter.",
  ].join("\n");

  const schema = {
    strategie: {
      objectif: "string",
      angle: "string",
      planning: ["string"],
      cta: "string",
      kpis: ["string"],
    },
    reels: [
      {
        titre: "string",
        hook: "string",
        scenario: "string",
        plans: ["string"],
        texteOnScreen: "string",
        caption: "string",
        cta: "string",
        hashtags: ["string"],
      },
    ],
    stories: [
      {
        titre: "string",
        sequence: ["string"],
        cta: "string",
      },
    ],
    themes: [
      {
        theme: "string",
        pourquoi: "string",
        variantes: ["string"],
      },
    ],
    checklist: ["string"],
  };

  const context = [
    `Evenement: ${event.title}`,
    `Categorie: ${event.category}`,
    `Date de preparation (deadline interne): ${event.prepStartDate}`,
    `Date de post (publication): ${event.startDate}`,
    event.endDate ? `Fin (optionnel): ${event.endDate}` : null,
    event.notes ? `Notes: ${event.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    constraints,
    "",
    "Format JSON attendu (exemple de types, pas un exemple de contenu):",
    JSON.stringify(schema),
    "",
    "Contexte:",
    context,
    "",
    "Retourne le JSON complet maintenant.",
  ].join("\n");
}

async function openAiChatJson(prompt: string, model: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY manquant (env).");

  type OpenAiChatResponse = {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        { role: "system", content: "Tu es un assistant qui repond uniquement avec du JSON valide." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as unknown as OpenAiChatResponse;
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenAI: reponse vide.");
  }
  const cleaned = stripJsonFences(content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("OpenAI: JSON invalide (parse impossible).");
  }
  return { parsed, raw: cleaned };
}

type SuggestionJson = {
  strategie: {
    objectif: string;
    angle: string;
    planning: string[];
    cta: string;
    kpis: string[];
  };
  reels: Array<{
    titre: string;
    hook: string;
    scenario: string;
    plans: string[];
    texteOnScreen: string;
    caption: string;
    cta: string;
    hashtags: string[];
  }>;
  stories: Array<{
    titre: string;
    sequence: string[];
    cta: string;
  }>;
  themes: Array<{
    theme: string;
    pourquoi: string;
    variantes: string[];
  }>;
  checklist: string[];
};

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === "string");
}

function isSuggestionJson(value: unknown): value is SuggestionJson {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (!v.strategie || typeof v.strategie !== "object") return false;
  const s = v.strategie as Record<string, unknown>;
  if (typeof s.objectif !== "string") return false;
  if (typeof s.angle !== "string") return false;
  if (!isStringArray(s.planning)) return false;
  if (typeof s.cta !== "string") return false;
  if (!isStringArray(s.kpis)) return false;
  if (!Array.isArray(v.reels)) return false;
  if (!Array.isArray(v.stories)) return false;
  if (!Array.isArray(v.themes)) return false;
  if (!isStringArray(v.checklist)) return false;
  return true;
}

function assertSuggestionShape(value: unknown): asserts value is SuggestionJson {
  if (!isSuggestionJson(value)) {
    throw new Error("JSON invalide: format attendu non respecte.");
  }
}

export const listEventsWithSuggestionsMeta = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    const events = await ctx.db.query("editorialEvents").collect();
    const visible = events.filter((event) => canAccessEvent(profile.role, profile._id, event));

    const suggestions = await ctx.db.query("editorialEventAiSuggestions").collect();
    const latestByEvent = new Map<string, { updatedAt: number; status: "ready" | "generating" | "error" }>();
    for (const s of suggestions) {
      const key = String(s.eventId);
      const prev = latestByEvent.get(key);
      if (!prev || s.updatedAt > prev.updatedAt) {
        latestByEvent.set(key, { updatedAt: s.updatedAt, status: s.status });
      }
    }

    return visible
      .slice()
      .sort((a, b) => {
        if (a.prepStartDate !== b.prepStartDate) return a.prepStartDate.localeCompare(b.prepStartDate);
        if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
        return a.title.localeCompare(b.title);
      })
      .map((event) => {
        const meta = latestByEvent.get(String(event._id)) ?? null;
        return {
          event,
          suggestion: meta
            ? { hasSuggestion: true, updatedAt: meta.updatedAt, status: meta.status }
            : { hasSuggestion: false, updatedAt: null as number | null, status: null as null },
        };
      });
  },
});

export const getSuggestionForEvent = query({
  args: { eventId: v.id("editorialEvents") },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const event = await ctx.db.get(args.eventId);
    // IMPORTANT: this query is used directly by the UI via `useQuery`.
    // Throwing here would crash the page (React render error). We return null instead.
    if (!event) return null;
    if (!canAccessEvent(profile.role, profile._id, event)) return null;

    // Prefer the latest by updatedAt. If `.order` isn't available, fall back to JS sort.
    const candidates = await ctx.db
      .query("editorialEventAiSuggestions")
      .withIndex("by_event_updatedAt", (q) => q.eq("eventId", args.eventId))
      .collect();
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.updatedAt - a.updatedAt);
    return candidates[0];
  },
});

export const getAiContextForEvent = query({
  args: { eventId: v.id("editorialEvents") },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Evenement introuvable");
    if (!canAccessEvent(profile.role, profile._id, event)) throw new Error("Non autorise");
    return { event, profileId: profile._id };
  },
});

export const generateSuggestionForEvent = action({
  args: {
    eventId: v.id("editorialEvents"),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ suggestionId: Id<"editorialEventAiSuggestions"> }> => {
    const { event, profileId } = await ctx.runQuery(api.communicationAi.getAiContextForEvent, {
      eventId: args.eventId,
    });

    const last = await ctx.runQuery(api.communicationAi.getSuggestionForEvent, { eventId: args.eventId });
    if (last && !args.force && last.updatedAt > minutesAgoMs(5)) {
      throw new Error("Suggestion recente: attend 5 minutes ou utilise 'Regenerer'.");
    }

    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
    const promptVersion = "v1";
    const inputSummary = buildInputSummary(event);
    const prompt = buildPrompt(event);

    const attempt = await ctx.runMutation(internal.communicationAiStorage.createSuggestionAttempt, {
      eventId: args.eventId,
      createdByProfileId: profileId,
      model,
      promptVersion,
      inputSummary,
    });

    try {
      const { parsed, raw } = await openAiChatJson(prompt, model);
      assertSuggestionShape(parsed);
      await ctx.runMutation(internal.communicationAiStorage.finishSuggestionAttempt, {
        suggestionId: attempt.suggestionId,
        status: "ready",
        resultJson: raw,
        errorMessage: undefined,
      });
      return { suggestionId: attempt.suggestionId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation IA impossible.";
      await ctx.runMutation(internal.communicationAiStorage.finishSuggestionAttempt, {
        suggestionId: attempt.suggestionId,
        status: "error",
        errorMessage: msg,
      });
      throw new Error(msg);
    }
  },
});
