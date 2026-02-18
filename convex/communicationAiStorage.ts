import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

function nowMs() {
  return Date.now();
}

export const createSuggestionAttempt = internalMutation({
  args: {
    eventId: v.id("editorialEvents"),
    createdByProfileId: v.id("profiles"),
    model: v.string(),
    promptVersion: v.string(),
    inputSummary: v.string(),
  },
  handler: async (ctx, args) => {
    const ts = nowMs();
    const id = await ctx.db.insert("editorialEventAiSuggestions", {
      eventId: args.eventId,
      createdByProfileId: args.createdByProfileId,
      createdAt: ts,
      updatedAt: ts,
      status: "generating",
      model: args.model,
      promptVersion: args.promptVersion,
      inputSummary: args.inputSummary,
      resultJson: "{}",
      errorMessage: undefined,
    });
    return { suggestionId: id };
  },
});

export const finishSuggestionAttempt = internalMutation({
  args: {
    suggestionId: v.id("editorialEventAiSuggestions"),
    status: v.union(v.literal("ready"), v.literal("error")),
    resultJson: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: {
      updatedAt: number;
      status: "ready" | "error";
      resultJson?: string;
      errorMessage?: string;
    } = {
      updatedAt: nowMs(),
      status: args.status,
    };
    if (args.resultJson !== undefined) patch.resultJson = args.resultJson;
    if (args.errorMessage !== undefined) {
      patch.errorMessage = args.errorMessage?.trim() || undefined;
    }

    await ctx.db.patch(args.suggestionId, patch);
    return { suggestionId: args.suggestionId };
  },
});

