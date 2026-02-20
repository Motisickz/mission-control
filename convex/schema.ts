import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  profiles: defineTable({
    authUserId: v.id("users"),
    email: v.string(),
    displayName: v.string(),
    role: v.union(v.literal("admin"), v.literal("stagiaire")),
    timezone: v.string(),
  })
    .index("by_auth_user_id", ["authUserId"])
    .index("by_email", ["email"]),

  calendarFilters: defineTable({
    name: v.string(),
    color: v.string(),
    ownerProfileId: v.id("profiles"),
    isSystem: v.boolean(),
    criteria: v.optional(v.string()),
  }).index("by_owner", ["ownerProfileId"]),

  taskTemplates: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.string(),
    endTime: v.string(),
    templateType: v.optional(v.union(v.literal("daily_block"), v.literal("weekly_reminder"))),
    weekday: v.optional(
      v.union(
        v.literal("mon"),
        v.literal("tue"),
        v.literal("wed"),
        v.literal("thu"),
        v.literal("fri"),
        v.literal("sat"),
        v.literal("sun"),
      ),
    ),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    priority: v.union(v.literal("urgent"), v.literal("high"), v.literal("medium"), v.literal("low")),
    assigneeProfileId: v.id("profiles"),
    createdByProfileId: v.id("profiles"),
    active: v.boolean(),
  })
    .index("by_assignee", ["assigneeProfileId"])
    .index("by_creator", ["createdByProfileId"]),

  spaces: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    visibility: v.union(v.literal("private"), v.literal("shared")),
    kind: v.union(v.literal("personal"), v.literal("team"), v.literal("custom")),
    ownerId: v.id("profiles"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_kind", ["ownerId", "kind"])
    .index("by_kind", ["kind"]),

  spaceMembers: defineTable({
    spaceId: v.id("spaces"),
    userId: v.id("profiles"),
    roleInSpace: v.union(v.literal("owner"), v.literal("member")),
    createdAt: v.number(),
  })
    .index("by_space", ["spaceId"])
    .index("by_user_space", ["userId", "spaceId"]),

  boardColumns: defineTable({
    spaceId: v.optional(v.id("spaces")),
    name: v.string(),
    order: v.number(),
  })
    .index("by_order", ["order"])
    .index("by_space_order", ["spaceId", "order"]),

  tasks: defineTable({
    title: v.string(),
    type: v.optional(v.union(v.literal("routine"), v.literal("exception"), v.literal("event"))),
    description: v.optional(v.string()),
    note: v.optional(v.string()),
    notes: v.optional(v.string()),
    priority: v.union(
      v.literal("urgent"),
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("blocked"),
      v.literal("done"),
    ),
    date: v.string(),
    dueDate: v.optional(v.string()),
    startTime: v.string(),
    endTime: v.string(),
    assigneeProfileId: v.id("profiles"),
    assigneeProfileIds: v.optional(v.array(v.id("profiles"))),
    columnId: v.optional(v.id("boardColumns")),
    order: v.optional(v.number()),
    boardCard: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
    createdByProfileId: v.id("profiles"),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    period: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("none")),
    entryType: v.optional(
      v.union(
        v.literal("task"),
        v.literal("meeting"),
        v.literal("event"),
        v.literal("daily_block"),
      ),
    ),
    checklist: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        text: v.optional(v.string()),
        done: v.boolean(),
      }),
    ),
    commentsCount: v.optional(v.number()),
    calendarFilterIds: v.array(v.id("calendarFilters")),
    isRecurringInstance: v.boolean(),
    templateId: v.optional(v.id("taskTemplates")),
  })
    .index("by_assignee", ["assigneeProfileId"])
    .index("by_type", ["type"])
    .index("by_type_column_order", ["type", "columnId", "order"])
    .index("by_column_order", ["columnId", "order"])
    .index("by_date", ["date"])
    .index("by_assignee_date", ["assigneeProfileId", "date"])
    .index("by_period", ["period"]),

  boardCardInstances: defineTable({
    spaceId: v.id("spaces"),
    cardId: v.id("tasks"),
    columnId: v.id("boardColumns"),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_space_order", ["spaceId", "columnId", "order"])
    .index("by_space_card", ["spaceId", "cardId"])
    .index("by_card", ["cardId"]),

  ideas: defineTable({
    title: v.string(),
    content: v.string(),
    authorProfileId: v.id("profiles"),
    status: v.union(
      v.literal("open"),
      v.literal("in_review"),
      v.literal("adopted"),
      v.literal("archived"),
    ),
  }).index("by_author", ["authorProfileId"]),

  notifications: defineTable({
    recipientProfileId: v.id("profiles"),
    type: v.union(v.literal("assigned"), v.literal("status_changed"), v.literal("overdue")),
    title: v.string(),
    payload: v.optional(v.string()),
    readAt: v.optional(v.number()),
  })
    .index("by_recipient", ["recipientProfileId"])
    .index("by_recipient_readAt", ["recipientProfileId", "readAt"]),

  missionSnapshots: defineTable({
    profileId: v.id("profiles"),
    period: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    dateRef: v.string(),
    total: v.number(),
    done: v.number(),
    progress: v.number(),
  }).index("by_profile_period", ["profileId", "period"]),

  showNoShow: defineTable({
    dateDuRdv: v.string(),
    nom: v.string(),
    lieuDuRdv: v.union(v.literal("studio"), v.literal("zoom")),
    confirme: v.union(v.literal("Oui"), v.literal("Non")),
    presence: v.union(v.literal("Show"), v.literal("No Show"), v.literal("Annulé par l'artiste")),
    vente: v.union(v.literal("Oui"), v.literal("Non"), v.literal("Devis envoyé")),
    typeDeVente: v.union(v.literal("Compo/Arrangement"), v.literal("Prise de voix")),
    commentaires: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("profiles"),
  }).index("by_date_du_rdv", ["dateDuRdv"]),

  missedCalls: defineTable({
    dateEtHoraireAppelManque: v.string(),
    numeroDeTel: v.string(),
    contactHubspot: v.string(),
    messageVocal: v.boolean(),
    rappele1foisAsap: v.boolean(),
    rappele2foisJ1: v.boolean(),
    commentaires: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("profiles"),
  }).index("by_date_et_horaire", ["dateEtHoraireAppelManque"]),

  editorialEvents: defineTable({
    title: v.string(),
    category: v.union(v.literal("marronnier"), v.literal("soldes"), v.literal("interne")),
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.optional(v.string()), // YYYY-MM-DD
    prepStartDate: v.string(), // YYYY-MM-DD
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
    templateAppliedAt: v.optional(v.string()), // YYYY-MM-DD (Paris)
  })
    .index("by_startDate", ["startDate"])
    .index("by_prepStartDate", ["prepStartDate"])
    .index("by_owner", ["ownerProfileId"])
    .index("by_owner_prepStartDate", ["ownerProfileId", "prepStartDate"]),

  communicationTasks: defineTable({
    eventId: v.id("editorialEvents"),
    title: v.string(),
    assigneeProfileId: v.id("profiles"),
    dueDate: v.string(), // YYYY-MM-DD
    status: v.union(v.literal("todo"), v.literal("doing"), v.literal("done")),
    checklist: v.optional(
      v.array(
        v.object({
          id: v.string(),
          label: v.string(),
          done: v.boolean(),
        }),
      ),
    ),
    comments: v.optional(v.string()),
    createdByProfileId: v.id("profiles"),
  })
    .index("by_event", ["eventId"])
    .index("by_dueDate", ["dueDate"])
    .index("by_assignee_dueDate", ["assigneeProfileId", "dueDate"]),

  editorialEventAiSuggestions: defineTable({
    eventId: v.id("editorialEvents"),
    createdByProfileId: v.id("profiles"),
    createdAt: v.number(), // ms timestamp
    updatedAt: v.number(), // ms timestamp
    status: v.union(v.literal("ready"), v.literal("generating"), v.literal("error")),
    model: v.string(),
    promptVersion: v.string(),
    inputSummary: v.string(),
    resultJson: v.string(),
    errorMessage: v.optional(v.string()),
  })
    .index("by_event", ["eventId"])
    .index("by_event_updatedAt", ["eventId", "updatedAt"]),
});
