import type { Doc, Id } from "../../convex/_generated/dataModel";
import type {
  IdeaStatus,
  NotificationType,
  Role,
  TaskPeriod,
  TaskPriority,
  TaskStatus,
} from "@/lib/domain-constants";

export type ProfileDoc = Doc<"profiles">;
export type TaskDoc = Doc<"tasks">;
export type IdeaDoc = Doc<"ideas">;
export type NotificationDoc = Doc<"notifications">;

export type RoleType = Role;
export type TaskStatusType = TaskStatus;
export type TaskPriorityType = TaskPriority;
export type TaskPeriodType = TaskPeriod;
export type IdeaStatusType = IdeaStatus;
export type NotificationTypeType = NotificationType;

export type TaskChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export type NewTaskInput = {
  title: string;
  description?: string;
  note?: string;
  assigneeProfileId: Id<"profiles">;
  date: string;
  dueDate?: string;
  startTime: string;
  endTime: string;
  priority: TaskPriority;
  status?: TaskStatus;
  period?: TaskPeriod;
  checklist?: TaskChecklistItem[];
  calendarFilterIds?: Id<"calendarFilters">[];
  recurringTemplateId?: Id<"taskTemplates">;
};
