import type { Doc, Id } from "../../convex/_generated/dataModel";
import type {
  IdeaStatus,
  NotificationType,
  Role,
  TaskEntryType,
  TaskPeriod,
  TaskPriority,
  TaskStatus,
  TaskType,
  WeekdayKey,
} from "@/lib/domain-constants";

export type ProfileDoc = Doc<"profiles">;
export type TaskDoc = Doc<"tasks">;
export type IdeaDoc = Doc<"ideas">;
export type NotificationDoc = Doc<"notifications">;

export type RoleType = Role;
export type TaskStatusType = TaskStatus;
export type TaskPriorityType = TaskPriority;
export type TaskTypeType = TaskType;
export type TaskPeriodType = TaskPeriod;
export type IdeaStatusType = IdeaStatus;
export type NotificationTypeType = NotificationType;
export type TaskEntryTypeType = TaskEntryType;
export type WeekdayKeyType = WeekdayKey;

export type TaskChecklistItem = {
  id: string;
  label: string;
  text?: string;
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
  type?: TaskType;
  status?: TaskStatus;
  period?: TaskPeriod;
  entryType?: TaskEntryType;
  checklist?: TaskChecklistItem[];
  calendarFilterIds?: Id<"calendarFilters">[];
  columnId?: Id<"boardColumns">;
  order?: number;
  assigneeProfileIds?: Id<"profiles">[];
  tags?: string[];
  notes?: string;
  recurringTemplateId?: Id<"taskTemplates">;
};
