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
    priority: v.union(v.literal("urgent"), v.literal("medium"), v.literal("low")),
    assigneeProfileId: v.id("profiles"),
    createdByProfileId: v.id("profiles"),
    active: v.boolean(),
  })
    .index("by_assignee", ["assigneeProfileId"])
    .index("by_creator", ["createdByProfileId"]),

  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    note: v.optional(v.string()),
    priority: v.union(v.literal("urgent"), v.literal("medium"), v.literal("low")),
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
    createdByProfileId: v.id("profiles"),
    period: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("none")),
    checklist: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        done: v.boolean(),
      }),
    ),
    calendarFilterIds: v.array(v.id("calendarFilters")),
    isRecurringInstance: v.boolean(),
    templateId: v.optional(v.id("taskTemplates")),
  })
    .index("by_assignee", ["assigneeProfileId"])
    .index("by_date", ["date"])
    .index("by_assignee_date", ["assigneeProfileId", "date"])
    .index("by_period", ["period"]),

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
});
