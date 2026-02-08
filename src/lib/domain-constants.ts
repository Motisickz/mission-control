export const APP_NAME = "Mission controle";
export const DEFAULT_TIMEZONE = "Europe/Paris";

export const ROLES = {
  ADMIN: "admin",
  STAGIAIRE: "stagiaire",
} as const;

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  stagiaire: "Stagiaire",
};

export const TASK_STATUSES = {
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  BLOCKED: "blocked",
  DONE: "done",
} as const;

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "A faire",
  in_progress: "En cours",
  blocked: "Bloque",
  done: "Termine",
};

export const TASK_PRIORITIES = {
  URGENT: "urgent",
  MEDIUM: "medium",
  LOW: "low",
} as const;

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgent",
  medium: "Moyen",
  low: "Faible",
};

export const TASK_PRIORITY_COLOR_TOKEN: Record<TaskPriority, string> = {
  urgent: "var(--priority-urgent)",
  medium: "var(--priority-medium)",
  low: "var(--priority-low)",
};

export const PERIODS = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  NONE: "none",
} as const;

export const PERIOD_LABELS: Record<TaskPeriod, string> = {
  daily: "Mission du jour",
  weekly: "Mission de la semaine",
  monthly: "Mensuel",
  none: "Hors periode",
};

export const IDEA_STATUSES = {
  OPEN: "open",
  IN_REVIEW: "in_review",
  ADOPTED: "adopted",
  ARCHIVED: "archived",
} as const;

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  open: "Ouverte",
  in_review: "En revue",
  adopted: "Adoptee",
  archived: "Archivee",
};

export const NOTIFICATION_TYPES = {
  ASSIGNED: "assigned",
  STATUS_CHANGED: "status_changed",
  OVERDUE: "overdue",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
export type TaskStatus = (typeof TASK_STATUSES)[keyof typeof TASK_STATUSES];
export type TaskPriority = (typeof TASK_PRIORITIES)[keyof typeof TASK_PRIORITIES];
export type TaskPeriod = (typeof PERIODS)[keyof typeof PERIODS];
export type IdeaStatus = (typeof IDEA_STATUSES)[keyof typeof IDEA_STATUSES];
export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export const MAIN_NAV = [
  { href: "/missions", label: "Missions" },
  { href: "/calendrier", label: "Calendrier" },
  { href: "/profils", label: "Profils" },
  { href: "/idees", label: "Idees" },
  { href: "/notifications", label: "Notifications" },
] as const;
