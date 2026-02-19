export const APP_NAME = "Mission contrôle";
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
  todo: "À faire",
  in_progress: "En cours",
  blocked: "Bloqué",
  done: "Terminé",
};

export const TASK_PRIORITIES = {
  URGENT: "urgent",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const;

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "Élevé",
  medium: "Moyen",
  low: "Faible",
};

export const TASK_PRIORITY_COLOR_TOKEN: Record<TaskPriority, string> = {
  urgent: "var(--priority-urgent)",
  high: "var(--priority-medium)",
  medium: "var(--priority-medium)",
  low: "var(--priority-low)",
};

export const TASK_TYPES = {
  ROUTINE: "routine",
  EXCEPTION: "exception",
  EVENT: "event",
} as const;

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  routine: "Routine",
  exception: "Exception",
  event: "Événement",
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
  none: "Hors période",
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
  adopted: "Adoptée",
  archived: "Archivée",
};

export const EDITORIAL_EVENT_CATEGORIES = {
  MARRONNIER: "marronnier",
  SOLDES: "soldes",
  INTERNE: "interne",
} as const;

export const EDITORIAL_EVENT_CATEGORY_LABELS: Record<EditorialEventCategory, string> = {
  marronnier: "Marronnier",
  soldes: "Soldes",
  interne: "Interne",
};

export const EDITORIAL_EVENT_PRIORITIES = {
  FAIBLE: "faible",
  MOYEN: "moyen",
  ELEVE: "eleve", // DB value without accent; label keeps "Élevé".
} as const;

export const EDITORIAL_EVENT_PRIORITY_LABELS: Record<EditorialEventPriority, string> = {
  faible: "Faible",
  moyen: "Moyen",
  eleve: "Élevé",
};

export const EDITORIAL_EVENT_STATUSES = {
  A_PREPARER: "a_preparer",
  EN_CREATION: "en_creation",
  PROGRAMME: "programme",
  PUBLIE: "publie",
  REX: "rex",
} as const;

export const EDITORIAL_EVENT_STATUS_LABELS: Record<EditorialEventStatus, string> = {
  a_preparer: "À préparer",
  en_creation: "En création",
  programme: "Programmé",
  publie: "Publié",
  rex: "REX",
};

export const COMMUNICATION_TASK_STATUSES = {
  TODO: "todo",
  DOING: "doing",
  DONE: "done",
} as const;

export const COMMUNICATION_TASK_STATUS_LABELS: Record<CommunicationTaskStatus, string> = {
  todo: "À faire",
  doing: "En cours",
  done: "Terminé",
};

export const NOTIFICATION_TYPES = {
  ASSIGNED: "assigned",
  STATUS_CHANGED: "status_changed",
  OVERDUE: "overdue",
} as const;

export const TASK_ENTRY_TYPES = {
  TASK: "task",
  MEETING: "meeting",
  EVENT: "event",
  DAILY_BLOCK: "daily_block",
} as const;

export const TASK_ENTRY_TYPE_LABELS: Record<TaskEntryType, string> = {
  task: "Tâche",
  meeting: "Réunion",
  event: "Événement",
  daily_block: "Bloc quotidien",
};

export const TASK_ENTRY_TYPE_COLORS: Record<TaskEntryType, string> = {
  task: "oklch(0.82 0.11 248)",
  meeting: "oklch(0.83 0.11 172)",
  event: "oklch(0.86 0.09 44)",
  daily_block: "oklch(0.83 0.09 296)",
};

export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: "Lundi",
  tue: "Mardi",
  wed: "Mercredi",
  thu: "Jeudi",
  fri: "Vendredi",
  sat: "Samedi",
  sun: "Dimanche",
};

export type Role = (typeof ROLES)[keyof typeof ROLES];
export type TaskStatus = (typeof TASK_STATUSES)[keyof typeof TASK_STATUSES];
export type TaskPriority = (typeof TASK_PRIORITIES)[keyof typeof TASK_PRIORITIES];
export type TaskType = (typeof TASK_TYPES)[keyof typeof TASK_TYPES];
export type TaskPeriod = (typeof PERIODS)[keyof typeof PERIODS];
export type IdeaStatus = (typeof IDEA_STATUSES)[keyof typeof IDEA_STATUSES];
export type EditorialEventCategory =
  (typeof EDITORIAL_EVENT_CATEGORIES)[keyof typeof EDITORIAL_EVENT_CATEGORIES];
export type EditorialEventPriority =
  (typeof EDITORIAL_EVENT_PRIORITIES)[keyof typeof EDITORIAL_EVENT_PRIORITIES];
export type EditorialEventStatus =
  (typeof EDITORIAL_EVENT_STATUSES)[keyof typeof EDITORIAL_EVENT_STATUSES];
export type CommunicationTaskStatus =
  (typeof COMMUNICATION_TASK_STATUSES)[keyof typeof COMMUNICATION_TASK_STATUSES];
export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];
export type TaskEntryType = (typeof TASK_ENTRY_TYPES)[keyof typeof TASK_ENTRY_TYPES];
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export type MainNavChild = {
  href: string;
  label: string;
};

export type MainNavItem = {
  href: string;
  label: string;
  children?: MainNavChild[];
};

export const MAIN_NAV: MainNavItem[] = [
  {
    href: "/missions",
    label: "Missions",
    children: [
      { href: "/missions/bloc-temps", label: "Bloc de temps quotidien" },
      { href: "/missions/priorites", label: "Priorités du jour" },
      { href: "/missions/board", label: "Board" },
      { href: "/missions/rappel-hebdo", label: "Rappel hebdomadaire" },
      { href: "/missions/show-no-show", label: "Show / No show" },
      { href: "/missions/appels-manques", label: "Appels manqués" },
    ],
  },
  {
    href: "/calendrier",
    label: "Calendrier",
  },
  {
    href: "/communication",
    label: "Communication",
    children: [
      { href: "/communication/calendar", label: "Calendrier éditorial" },
      { href: "/communication/events", label: "Événements" },
      { href: "/communication/suggestions", label: "Suggestion IA" },
    ],
  },
  { href: "/profils", label: "Profils" },
  { href: "/idees", label: "Idées" },
  { href: "/notifications", label: "Notifications" },
];

export const CALENDAR_FILTER_DEFAULT_COLOR = "oklch(0.8 0.08 248)";

export const CALENDAR_FILTER_COLOR_RULES = [
  {
    keywords: ["vente", "ventes", "sales", "business"],
    color: "oklch(0.86 0.08 52)",
  },
  {
    keywords: ["commercial", "prospection", "client", "crm"],
    color: "oklch(0.88 0.08 154)",
  },
  {
    keywords: ["marketing", "contenu", "social", "campagne"],
    color: "oklch(0.88 0.07 340)",
  },
  {
    keywords: ["finance", "budget", "facture", "compta"],
    color: "oklch(0.87 0.05 286)",
  },
  {
    keywords: ["support", "ticket", "sav"],
    color: "oklch(0.87 0.06 210)",
  },
  {
    keywords: ["ops", "opérations", "operation", "logistique", "planning"],
    color: "oklch(0.86 0.06 234)",
  },
] as const;
