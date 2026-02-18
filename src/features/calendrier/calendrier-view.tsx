"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus2, Check, ChevronLeft, ChevronRight, ClipboardList, Lightbulb, Users, X } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import type { Id } from "../../../convex/_generated/dataModel";

import { api } from "../../../convex/_generated/api";
import {
  CALENDAR_FILTER_COLOR_RULES,
  CALENDAR_FILTER_DEFAULT_COLOR,
  TASK_ENTRY_TYPE_COLORS,
  TASK_ENTRY_TYPE_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskEntryType,
} from "@/lib/domain-constants";
import { getSharedScopeProfileIds, isAssignedToAnyProfile } from "@/lib/shared-profile-scope";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DatePillPicker } from "@/components/ui/date-pill-picker";

type CalendarView = "day" | "week" | "month" | "year";

type CalendarRange = {
  startDate: string;
  endDate: string;
};

const WEEKDAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const FILTER_COLOR_PALETTE = [
  "oklch(0.84 0.1 25)",
  "oklch(0.84 0.1 45)",
  "oklch(0.85 0.09 70)",
  "oklch(0.84 0.1 110)",
  "oklch(0.84 0.1 145)",
  "oklch(0.83 0.1 170)",
  "oklch(0.83 0.1 205)",
  "oklch(0.83 0.1 235)",
  "oklch(0.83 0.1 265)",
  "oklch(0.84 0.1 295)",
  "oklch(0.84 0.1 325)",
  "oklch(0.84 0.1 350)",
] as const;

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function atNoon(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

function addDays(base: Date, days: number) {
  const d = atNoon(base);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeekMonday(base: Date) {
  const d = atNoon(base);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return d;
}

function endOfWeekMonday(base: Date) {
  return addDays(startOfWeekMonday(base), 6);
}

function startOfMonth(base: Date) {
  return new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0, 0);
}

function endOfMonth(base: Date) {
  return new Date(base.getFullYear(), base.getMonth() + 1, 0, 12, 0, 0, 0);
}

function startOfYear(base: Date) {
  return new Date(base.getFullYear(), 0, 1, 12, 0, 0, 0);
}

function endOfYear(base: Date) {
  return new Date(base.getFullYear(), 11, 31, 12, 0, 0, 0);
}

function getRange(view: CalendarView, cursor: Date): CalendarRange {
  if (view === "day") {
    const day = toIsoDate(cursor);
    return { startDate: day, endDate: day };
  }
  if (view === "week") {
    return {
      startDate: toIsoDate(startOfWeekMonday(cursor)),
      endDate: toIsoDate(endOfWeekMonday(cursor)),
    };
  }
  if (view === "year") {
    return {
      startDate: toIsoDate(startOfYear(cursor)),
      endDate: toIsoDate(endOfYear(cursor)),
    };
  }
  return {
    startDate: toIsoDate(startOfMonth(cursor)),
    endDate: toIsoDate(endOfMonth(cursor)),
  };
}

function moveCursor(base: Date, view: CalendarView, direction: -1 | 1) {
  if (view === "day") return addDays(base, direction);
  if (view === "week") return addDays(base, direction * 7);
  if (view === "month") return new Date(base.getFullYear(), base.getMonth() + direction, base.getDate(), 12);
  return new Date(base.getFullYear() + direction, base.getMonth(), base.getDate(), 12);
}

function dateLabel(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("fr-FR", options).format(date);
}

function dateKey(date: Date) {
  return toIsoDate(date);
}

function monthGridDays(cursor: Date) {
  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeekMonday(monthStart);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

function weekDays(cursor: Date) {
  const start = startOfWeekMonday(cursor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function yearMonths(cursor: Date) {
  return Array.from({ length: 12 }, (_, i) => new Date(cursor.getFullYear(), i, 1, 12));
}

function inferCalendarFilterColor(name: string, criteria: string) {
  const source = `${name} ${criteria}`.toLowerCase();
  const matched = CALENDAR_FILTER_COLOR_RULES.find((rule) =>
    rule.keywords.some((keyword) => source.includes(keyword)),
  );
  return matched?.color ?? CALENDAR_FILTER_DEFAULT_COLOR;
}

function hashToHue(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 360;
  }
  return hash;
}

function pickDistinctFilterColor(name: string, criteria: string, usedColors: Set<string>) {
  const suggested = inferCalendarFilterColor(name, criteria);
  if (!usedColors.has(suggested)) return suggested;

  const fromPalette = FILTER_COLOR_PALETTE.find((color) => !usedColors.has(color));
  if (fromPalette) return fromPalette;

  const hue = hashToHue(`${name}:${criteria}`);
  return `oklch(0.84 0.1 ${hue})`;
}

function normalizeEntryType(entryType?: string): TaskEntryType {
  if (entryType === "meeting" || entryType === "event" || entryType === "daily_block") {
    return entryType;
  }
  return "task";
}

function isFixedDailyBlock(task: { entryType?: string; templateId?: string }) {
  return task.entryType === "daily_block" && !!task.templateId;
}

export function CalendrierView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState<Date>(atNoon(new Date()));
  const [createPriority, setCreatePriority] = useState<"urgent" | "high" | "medium" | "low">("medium");
  const [createEntryType, setCreateEntryType] = useState<TaskEntryType>("task");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createAssigneeId, setCreateAssigneeId] = useState("");
  const [createFilterIds, setCreateFilterIds] = useState<Id<"calendarFilters">[]>([]);
  const [activeFilterIds, setActiveFilterIds] = useState<Id<"calendarFilters">[]>([]);
  const [createInitialDate, setCreateInitialDate] = useState(() => toIsoDate(new Date()));
  const [createFormNonce, setCreateFormNonce] = useState(0);
  const [isTaskEditing, setIsTaskEditing] = useState(false);
  const [isTaskSaving, setIsTaskSaving] = useState(false);
  const [taskEditPriority, setTaskEditPriority] = useState<"urgent" | "high" | "medium" | "low">("medium");
  const [taskEditStatus, setTaskEditStatus] = useState<"todo" | "in_progress" | "blocked" | "done">("todo");
  const [taskEditEntryType, setTaskEditEntryType] = useState<TaskEntryType>("task");
  const [taskEditFilterIds, setTaskEditFilterIds] = useState<Id<"calendarFilters">[]>([]);
  const [taskEditFormNonce, setTaskEditFormNonce] = useState(0);
  const [isTaskDeleting, setIsTaskDeleting] = useState(false);

  const range = useMemo(() => getRange(view, cursor), [view, cursor]);
  const cursorDate = useMemo(() => dateKey(cursor), [cursor]);
  const queriedOverviewTasks = useQuery(api.tasks.listCalendarRange, {
    ...range,
    activeFilterIds: activeFilterIds.length > 0 ? activeFilterIds : undefined,
    includeFixedDailyBlocks: false,
  });
  const queriedDayTasks = useQuery(
    api.tasks.listCalendarRange,
    view === "day"
      ? {
          startDate: cursorDate,
          endDate: cursorDate,
          includeFixedDailyBlocks: true,
        }
      : "skip",
  );
  const queriedFilterUsage = useQuery(api.tasks.listCalendarFilterUsage, range);
  const overviewTasks = useMemo(() => queriedOverviewTasks ?? [], [queriedOverviewTasks]);
  const dayTasks = useMemo(() => queriedDayTasks ?? [], [queriedDayTasks]);
  const filters = useQuery(api.calendar.list);
  const calendarFilters = useMemo(() => (filters ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)), [filters]);
  const notifications = useQuery(api.notifications.listForCurrentUser);
  const profiles = useQuery(api.profiles.listVisibleProfiles);
  const currentProfile = useQuery(api.profiles.getCurrentProfile);
  const sharedScopeProfileIds = useMemo(
    () => getSharedScopeProfileIds(currentProfile, profiles),
    [currentProfile, profiles],
  );
  const dailyTemplates = useQuery(api.tasksTemplates.listDailyTemplates);
  const createFilter = useMutation(api.calendar.createFilter);
  const deleteFilter = useMutation(api.calendar.deleteFilter);
  const createTask = useMutation(api.tasks.createTask);
  const updateTask = useMutation(api.tasks.updateTask);
  const deleteTask = useMutation(api.tasks.deleteTask);

  const filterColorById = useMemo(() => {
    const map = new Map<string, string>();
    for (const filter of calendarFilters) {
      map.set(filter._id, filter.color || inferCalendarFilterColor(filter.name, filter.criteria ?? ""));
    }
    return map;
  }, [calendarFilters]);

  const filterNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const filter of calendarFilters) {
      map.set(filter._id, filter.name);
    }
    return map;
  }, [calendarFilters]);

  const filterUsageById = useMemo(() => {
    const map = new Map<string, number>();
    for (const filter of calendarFilters) {
      map.set(filter._id, 0);
    }
    for (const item of queriedFilterUsage ?? []) {
      map.set(item.filterId, item.count);
    }
    return map;
  }, [calendarFilters, queriedFilterUsage]);

  const unreadNotifications = useMemo(
    () =>
      (notifications ?? [])
        .filter((notification) => !notification.readAt)
        .sort((a, b) => b._creationTime - a._creationTime),
    [notifications],
  );

  const overviewTasksByDate = useMemo(() => {
    const map = new Map<string, typeof overviewTasks>();
    for (const task of overviewTasks) {
      const key = task.date;
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    for (const [key, list] of map.entries()) {
      map.set(key, [...list].sort((a, b) => a.startTime.localeCompare(b.startTime)));
    }
    return map;
  }, [overviewTasks]);

  const selectedTask = useMemo(
    () =>
      overviewTasks.find((task) => task._id === selectedTaskId) ??
      dayTasks.find((task) => task._id === selectedTaskId) ??
      null,
    [selectedTaskId, overviewTasks, dayTasks],
  );
  const dayFixedBlocks = useMemo(
    () => dayTasks.filter((task) => isFixedDailyBlock(task)),
    [dayTasks],
  );
  const dayExceptionalTasks = useMemo(
    () => overviewTasksByDate.get(cursorDate) ?? [],
    [overviewTasksByDate, cursorDate],
  );
  const fixedBlockFallbackCount = dayFixedBlocks.length > 0 ? dayFixedBlocks.length : (dailyTemplates?.length ?? 0);

  const accentForTask = (task: (typeof overviewTasks)[number]) => {
    const preferredFilterId = task.calendarFilterIds.find((id) => filterColorById.has(id));
    if (preferredFilterId) return filterColorById.get(preferredFilterId)!;
    return TASK_ENTRY_TYPE_COLORS[normalizeEntryType(task.entryType)];
  };

  const periodLabel = useMemo(() => {
    if (view === "day") {
      return dateLabel(cursor, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    }
    if (view === "week") {
      const days = weekDays(cursor);
      const start = days[0];
      const end = days[6];
      if (!start || !end) return "";
      return `${dateLabel(start, { day: "numeric", month: "short" })} - ${dateLabel(end, { day: "numeric", month: "short", year: "numeric" })}`;
    }
    if (view === "year") return String(cursor.getFullYear());
    return dateLabel(cursor, { month: "long", year: "numeric" });
  }, [cursor, view]);

  const createDialogTitle =
    createEntryType === "meeting"
      ? "Nouvelle réunion"
      : createEntryType === "event"
        ? "Nouvel événement"
        : "Nouvelle tâche";
  const createSubmitLabel =
    createEntryType === "meeting"
      ? "Ajouter la réunion à l'agenda"
      : createEntryType === "event"
        ? "Ajouter l'événement à l'agenda"
        : "Ajouter la tâche à l'agenda";
  const openCreateDialog = (entryType: TaskEntryType, initialDate = cursorDate) => {
    setCreateEntryType(entryType);
    setCreatePriority("medium");
    setCreateAssigneeId(currentProfile?._id ?? profiles?.[0]?._id ?? "");
    setCreateFilterIds([]);
    setCreateInitialDate(initialDate);
    setCreateFormNonce((value) => value + 1);
    setCreateOpen(true);
  };

  const openTaskEdit = () => {
    if (!selectedTask) return;
    setSelectedTaskId(selectedTask._id);
    setTaskEditPriority(selectedTask.priority);
    setTaskEditStatus(selectedTask.status);
    setTaskEditEntryType(normalizeEntryType(selectedTask.entryType));
    setTaskEditFilterIds([...selectedTask.calendarFilterIds]);
    setTaskEditFormNonce((value) => value + 1);
    setIsTaskSaving(false);
    setIsTaskDeleting(false);
    setIsTaskEditing(true);
  };

  const openTaskEditFromMenu = (task: (typeof overviewTasks)[number]) => {
    setSelectedTaskId(task._id);
    setTaskEditPriority(task.priority);
    setTaskEditStatus(task.status);
    setTaskEditEntryType(normalizeEntryType(task.entryType));
    setTaskEditFilterIds([...task.calendarFilterIds]);
    setTaskEditFormNonce((value) => value + 1);
    setIsTaskSaving(false);
    setIsTaskDeleting(false);
    setIsTaskEditing(true);
  };

  const deleteTaskFromMenu = async (task: { _id: string; entryType?: string; title: string }) => {
    const entryLabel = TASK_ENTRY_TYPE_LABELS[normalizeEntryType(task.entryType)].toLowerCase();
    if (!window.confirm(`Supprimer ${entryLabel} "${task.title}" ? Cette action est irréversible.`)) {
      return;
    }

    try {
      await deleteTask({ taskId: task._id as Id<"tasks"> });
      if (selectedTaskId === task._id) {
        setSelectedTaskId(null);
      }
      toast.success("Élément supprimé.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de supprimer cet élément.";
      toast.error(message);
    }
  };

  useEffect(() => {
    const section = searchParams.get("section");
    if (!section) return;
    const element = document.getElementById(`section-${section}`);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [searchParams]);

  useEffect(() => {
    if (view !== "day") return;
    if (typeof window === "undefined") return;

    const now = Date.now();
    if (unreadNotifications.length === 0) {
      window.localStorage.setItem("mc-day-view-last-presence-at", String(now));
      return;
    }

    const lastPresenceAt = Number(window.localStorage.getItem("mc-day-view-last-presence-at") ?? "0");
    const lastToastMarker = Number(window.localStorage.getItem("mc-day-view-last-toast-marker") ?? "0");
    const unreadDuringAbsence = unreadNotifications.filter(
      (notification) => notification._creationTime > lastPresenceAt,
    );

    if (unreadDuringAbsence.length === 0) {
      window.localStorage.setItem("mc-day-view-last-presence-at", String(now));
      return;
    }

    const latestUnreadCreation = unreadDuringAbsence[0]?._creationTime ?? 0;
    if (latestUnreadCreation <= lastToastMarker) {
      window.localStorage.setItem("mc-day-view-last-presence-at", String(now));
      return;
    }

    const previewTitles = unreadDuringAbsence
      .slice(0, 2)
      .map((notification) => notification.title)
      .join(" • ");
    const remaining = unreadDuringAbsence.length - 2;
    const summary = remaining > 0 ? `${previewTitles} • +${remaining} autre(s)` : previewTitles;

    toast("Notifications reçues pendant ton absence", {
      description: summary,
      action: {
        label: "Voir",
        onClick: () => router.push("/notifications"),
      },
    });

    window.localStorage.setItem("mc-day-view-last-toast-marker", String(latestUnreadCreation));
    window.localStorage.setItem("mc-day-view-last-presence-at", String(now));
  }, [view, unreadNotifications, router]);

  useEffect(() => {
    setIsTaskEditing(false);
    setIsTaskSaving(false);
    setIsTaskDeleting(false);
    setTaskEditFilterIds([]);
  }, [selectedTaskId]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <Card id="section-agenda">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Calendrier</CardTitle>
                <Badge variant="secondary">{activeFilterIds.length} filtre(s) actif(s)</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button>
                        <CalendarPlus2 className="mr-2 h-4 w-4" />
                        Ajouter
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 p-2">
                      <DropdownMenuItem
                        className="mb-2 rounded-xl bg-cyan-500/10 py-3 text-cyan-700 focus:bg-cyan-500/20 focus:text-cyan-800"
                        onClick={() => openCreateDialog("meeting")}
                      >
                        <Users className="h-4 w-4" />
                        Réunions
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="mb-2 rounded-xl bg-indigo-500/10 py-3 text-indigo-700 focus:bg-indigo-500/20 focus:text-indigo-800"
                        onClick={() => openCreateDialog("task")}
                      >
                        <ClipboardList className="h-4 w-4" />
                        Tâche
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="rounded-xl bg-amber-500/10 py-3 text-amber-700 focus:bg-amber-500/20 focus:text-amber-800"
                        onClick={() => openCreateDialog("event")}
                      >
                        <Lightbulb className="h-4 w-4" />
                        Événements
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>{createDialogTitle}</DialogTitle>
                <DialogDescription>
                  {TASK_ENTRY_TYPE_LABELS[createEntryType]} complète avec date, échéance, note et assignation.
                </DialogDescription>
              </DialogHeader>
              <form
                key={createFormNonce}
                className="grid gap-x-4 gap-y-4 md:grid-cols-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const formEl = event.currentTarget;
                  const form = new FormData(formEl);
                  const assignee = createAssigneeId || currentProfile?._id || profiles?.[0]?._id || "";
                  if (!assignee) return;

                  await createTask({
                    title: String(form.get("title") ?? ""),
                    description: String(form.get("description") ?? ""),
                    note: String(form.get("note") ?? ""),
                    assigneeProfileId: assignee as never,
                    date: String(form.get("date") ?? toIsoDate(new Date())),
                    dueDate: String(form.get("dueDate") ?? ""),
                    startTime: String(form.get("startTime") ?? "09:00"),
                    endTime: String(form.get("endTime") ?? "10:00"),
                    priority: createPriority,
                    period: "none",
                    entryType: createEntryType,
                    checklist: [],
                    calendarFilterIds: createFilterIds as never,
                  });

                  formEl.reset();
                  setCreatePriority("medium");
                  setCreateAssigneeId(currentProfile?._id ?? profiles?.[0]?._id ?? "");
                  setCreateFilterIds([]);
                  setCreateFormNonce((value) => value + 1);
                  setCreateOpen(false);
                }}
              >
                <div className="space-y-1">
                  <Label>Titre</Label>
                  <Input name="title" required />
                </div>
                <div className="space-y-1">
                  <Label>Assigné(e)</Label>
                  <Select name="assignee" required value={createAssigneeId} onValueChange={setCreateAssigneeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {(profiles ?? []).map((profile) => (
                        <SelectItem key={profile._id} value={profile._id}>
                          {profile.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Description</Label>
                  <Input name="description" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Note</Label>
                  <Textarea name="note" placeholder="Contexte, détail, lien, livrable..." />
                </div>
                <div className="md:col-span-2 border-t border-border/70 pt-1" />
                <div className="space-y-1">
                  <Label>Date mission</Label>
                  <DatePillPicker name="date" defaultValue={createInitialDate} />
                </div>
                <div className="space-y-1">
                  <Label>Échéance</Label>
                  <DatePillPicker name="dueDate" defaultValue={createInitialDate} />
                </div>
                <div className="space-y-1">
                  <Label>Début</Label>
                  <Input name="startTime" type="time" defaultValue="09:00" />
                </div>
                <div className="space-y-1">
                  <Label>Fin</Label>
                  <Input name="endTime" type="time" defaultValue="10:00" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Priorité</Label>
                  <Select value={createPriority} onValueChange={(v) => setCreatePriority(v as typeof createPriority)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(TASK_PRIORITIES).map((value) => (
                        <SelectItem key={value} value={value}>
                          {TASK_PRIORITY_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 border-t border-border/70 pt-1" />
                <div className="space-y-1 md:col-span-2">
                  <Label>Filtres calendrier</Label>
                  {calendarFilters.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Aucun filtre disponible. Crée-en un dans le bloc &quot;Filtres calendrier&quot;.
                    </p>
                  ) : (
                    <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-xs text-muted-foreground">
                        La couleur de cette mission dans le calendrier suivra le premier filtre sélectionné.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {calendarFilters.map((filter) => {
                        const color = filter.color || inferCalendarFilterColor(filter.name, filter.criteria ?? "");
                        const selected = createFilterIds.includes(filter._id);
                        return (
                          <button
                            key={filter._id}
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                            style={{
                              borderColor: `color-mix(in oklch, ${color} 65%, white)`,
                              backgroundColor: selected
                                ? `color-mix(in oklch, ${color} 24%, white)`
                                : `color-mix(in oklch, ${color} 10%, white)`,
                            }}
                            onClick={() =>
                              setCreateFilterIds((current) =>
                                current.includes(filter._id)
                                  ? current.filter((id) => id !== filter._id)
                                  : [...current, filter._id],
                              )
                            }
                          >
                            {selected ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />}
                            {filter.name}
                          </button>
                        );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <Button
                    type="submit"
                    className="w-full"
                    style={{
                      backgroundColor: TASK_ENTRY_TYPE_COLORS[createEntryType],
                      color: "oklch(0.2 0.03 260)",
                    }}
                  >
                    {createSubmitLabel}
                  </Button>
                </div>
              </form>
                  </DialogContent>
                </Dialog>
                <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)}>
                  <TabsList>
                    <TabsTrigger value="day">Jour</TabsTrigger>
                    <TabsTrigger value="week">Semaine</TabsTrigger>
                    <TabsTrigger value="month">Mois</TabsTrigger>
                    <TabsTrigger value="year">Année</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setCursor((c) => moveCursor(c, view, -1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setCursor((c) => moveCursor(c, view, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => setCursor(atNoon(new Date()))}>Aujourd&apos;hui</Button>
              </div>
              <div className="flex items-center gap-2">
                {activeFilterIds.length > 0 ? (
                  <Button variant="ghost" size="sm" onClick={() => setActiveFilterIds([])}>
                    Effacer filtres ({activeFilterIds.length})
                  </Button>
                ) : null}
                <CardDescription className="text-sm font-medium text-foreground">{periodLabel}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
          {view === "day" && (
            <div className="space-y-4">
              <div className="rounded-md border border-border/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Répertoire des missions de la journée</p>
                  <Badge variant="outline">
                    {dayExceptionalTasks.length} exceptionnelles • {fixedBlockFallbackCount} quotidiennes
                  </Badge>
                </div>
                <div className="space-y-3">
                  {dayExceptionalTasks.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Missions exceptionnelles
                      </p>
                      {dayExceptionalTasks.map((task) => {
                        const entryType = normalizeEntryType(task.entryType);
                        const accentColor = accentForTask(task);
                        return (
                          <ContextMenu key={task._id}>
                            <ContextMenuTrigger asChild>
                              <button
                                className="w-full rounded-md border border-border/70 p-3 text-left hover:bg-primary/5"
                                onClick={() => setSelectedTaskId(task._id)}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium">{task.title}</p>
                                  <div className="flex items-center gap-1.5">
                                    <Badge
                                      variant="outline"
                                      style={{
                                        borderColor: `color-mix(in oklch, ${accentColor} 65%, white)`,
                                        backgroundColor: `color-mix(in oklch, ${accentColor} 20%, white)`,
                                      }}
                                    >
                                      {TASK_ENTRY_TYPE_LABELS[entryType]}
                                    </Badge>
                                    <Badge variant="secondary">{TASK_STATUS_LABELS[task.status]}</Badge>
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground">{task.startTime} - {task.endTime}</p>
                                {task.calendarFilterIds.length > 0 ? (
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {task.calendarFilterIds.map((filterId) => {
                                      const color = filterColorById.get(filterId);
                                      const label = filterNameById.get(filterId);
                                      if (!color || !label) return null;
                                      return (
                                        <Badge
                                          key={filterId}
                                          variant="outline"
                                          className="text-[11px]"
                                          style={{
                                            borderColor: `color-mix(in oklch, ${color} 62%, white)`,
                                            backgroundColor: `color-mix(in oklch, ${color} 16%, white)`,
                                          }}
                                        >
                                          {label}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                ) : null}
                                {isAssignedToAnyProfile(task, sharedScopeProfileIds) ? (
                                  <p className="mt-1 text-xs text-primary">Assignée à moi</p>
                                ) : null}
                              </button>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-52">
                              <ContextMenuLabel className="truncate">{task.title}</ContextMenuLabel>
                              <ContextMenuSeparator />
                              <ContextMenuItem onClick={() => setSelectedTaskId(task._id)}>
                                Ouvrir le détail
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => openTaskEditFromMenu(task)}>
                                Modifier
                              </ContextMenuItem>
                              <ContextMenuItem
                                variant="destructive"
                                onClick={() => {
                                  void deleteTaskFromMenu(task);
                                }}
                              >
                                Supprimer
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucune mission exceptionnelle sur cette date.
                    </p>
                  )}

                  <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-2.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Bloc quotidien (figé)
                    </p>
                    {dayFixedBlocks.length > 0 ? (
                      dayFixedBlocks.map((task) => (
                        <ContextMenu key={task._id}>
                          <ContextMenuTrigger asChild>
                            <button
                              className="w-full rounded-md border border-border/70 bg-background p-2.5 text-left hover:bg-primary/5"
                              onClick={() => setSelectedTaskId(task._id)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-medium">{task.title}</p>
                                <Badge variant="outline">Quotidien</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{task.startTime} - {task.endTime}</p>
                            </button>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-52">
                            <ContextMenuLabel className="truncate">{task.title}</ContextMenuLabel>
                            <ContextMenuSeparator />
                            <ContextMenuItem onClick={() => setSelectedTaskId(task._id)}>
                              Ouvrir le détail
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => openTaskEditFromMenu(task)}>
                              Modifier
                            </ContextMenuItem>
                            <ContextMenuItem
                              variant="destructive"
                              onClick={() => {
                                void deleteTaskFromMenu(task);
                              }}
                            >
                              Supprimer
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))
                    ) : (dailyTemplates?.length ?? 0) > 0 ? (
                      dailyTemplates!.map((template) => (
                        <div key={template._id} className="rounded-md border border-border/70 bg-background p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium">{template.title}</p>
                            <Badge variant="outline">Quotidien</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {template.startTime} - {template.endTime}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Aucun bloc quotidien figé défini.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === "week" && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
              {weekDays(cursor).map((day) => {
                const key = dateKey(day);
                const list = overviewTasksByDate.get(key) ?? [];
                const dayCell = (
                  <div
                    className="cursor-pointer rounded-md border border-border/70 p-2 text-left"
                    onClick={() => {
                      setCursor(day);
                      setView("day");
                    }}
                  >
                    <p className="text-xs text-muted-foreground">{WEEKDAY_SHORT[(day.getDay() + 6) % 7]}</p>
                    <p className="mb-2 text-sm font-medium">{dateLabel(day, { day: "2-digit", month: "2-digit" })}</p>
                    <div className="space-y-1">
                      {list.slice(0, 5).map((task) => {
                        const accentColor = accentForTask(task);
                        return (
                          <ContextMenu key={task._id}>
                            <ContextMenuTrigger asChild>
                              <button
                                className="block w-full rounded px-2 py-1 text-left text-xs"
                                style={{
                                  backgroundColor: `color-mix(in oklch, ${accentColor} 18%, white)`,
                                }}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedTaskId(task._id);
                                }}
                              >
                                <p className="truncate font-medium">{task.title}</p>
                                <p className="text-muted-foreground">{task.startTime}</p>
                              </button>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-52">
                              <ContextMenuLabel className="truncate">{task.title}</ContextMenuLabel>
                              <ContextMenuSeparator />
                              <ContextMenuItem onClick={() => setSelectedTaskId(task._id)}>
                                Ouvrir le détail
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => openTaskEditFromMenu(task)}>
                                Modifier
                              </ContextMenuItem>
                              <ContextMenuItem
                                variant="destructive"
                                onClick={() => {
                                  void deleteTaskFromMenu(task);
                                }}
                              >
                                Supprimer
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                      {list.length > 5 && <p className="text-xs text-muted-foreground">+{list.length - 5} autres</p>}
                    </div>
                  </div>
                );

                if (list.length > 0) {
                  return <div key={key}>{dayCell}</div>;
                }

                return (
                  <ContextMenu key={key}>
                    <ContextMenuTrigger asChild>{dayCell}</ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuLabel>{dateLabel(day, { weekday: "short", day: "numeric", month: "short" })}</ContextMenuLabel>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => openCreateDialog("task", key)}>
                        Créer une tâche
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => openCreateDialog("meeting", key)}>
                        Créer une réunion
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => openCreateDialog("event", key)}>
                        Créer un événement
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
            </div>
          )}

          {view === "month" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Cette vue affiche uniquement les missions exceptionnelles. Clique sur un jour pour voir le bloc quotidien figé.
              </p>
              <div className="grid grid-cols-7 gap-2">
                {WEEKDAY_SHORT.map((label) => (
                  <p key={label} className="px-1 text-xs font-medium text-muted-foreground">{label}</p>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {monthGridDays(cursor).map((day) => {
                  const currentMonth = day.getMonth() === cursor.getMonth();
                  const key = dateKey(day);
                  const list = overviewTasksByDate.get(key) ?? [];

                  const dayCell = (
                    <div
                      className={
                        "min-h-28 cursor-pointer rounded-md border border-border/70 p-2 text-left " +
                        (currentMonth ? "bg-background" : "bg-muted/40")
                      }
                      onClick={() => {
                        setCursor(day);
                        setView("day");
                      }}
                    >
                      <p className={"text-xs " + (currentMonth ? "text-foreground" : "text-muted-foreground")}>{day.getDate()}</p>
                      <div className="mt-1 space-y-1">
                        {list.slice(0, 3).map((task) => {
                          const accentColor = accentForTask(task);
                          return (
                            <ContextMenu key={task._id}>
                              <ContextMenuTrigger asChild>
                                <button
                                  className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px]"
                                  style={{
                                    backgroundColor: `color-mix(in oklch, ${accentColor} 18%, white)`,
                                  }}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedTaskId(task._id);
                                  }}
                                >
                                  {task.startTime} {task.title}
                                </button>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-52">
                                <ContextMenuLabel className="truncate">{task.title}</ContextMenuLabel>
                                <ContextMenuSeparator />
                                <ContextMenuItem onClick={() => setSelectedTaskId(task._id)}>
                                  Ouvrir le détail
                                </ContextMenuItem>
                                <ContextMenuItem onClick={() => openTaskEditFromMenu(task)}>
                                  Modifier
                                </ContextMenuItem>
                                <ContextMenuItem
                                  variant="destructive"
                                  onClick={() => {
                                    void deleteTaskFromMenu(task);
                                  }}
                                >
                                  Supprimer
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          );
                        })}
                        {list.length > 3 && <p className="text-[11px] text-muted-foreground">+{list.length - 3} autres</p>}
                      </div>
                    </div>
                  );

                  if (list.length > 0) {
                    return <div key={key}>{dayCell}</div>;
                  }

                  return (
                    <ContextMenu key={key}>
                      <ContextMenuTrigger asChild>{dayCell}</ContextMenuTrigger>
                      <ContextMenuContent className="w-56">
                        <ContextMenuLabel>{dateLabel(day, { weekday: "short", day: "numeric", month: "short" })}</ContextMenuLabel>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => openCreateDialog("task", key)}>
                          Créer une tâche
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => openCreateDialog("meeting", key)}>
                          Créer une réunion
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => openCreateDialog("event", key)}>
                          Créer un événement
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>
            </div>
          )}

          {view === "year" && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {yearMonths(cursor).map((monthStart) => {
                const monthName = dateLabel(monthStart, { month: "long" });
                const monthStartKey = toIsoDate(startOfMonth(monthStart));
                const monthEndKey = toIsoDate(endOfMonth(monthStart));
                const monthCount = overviewTasks.filter((task) => task.date >= monthStartKey && task.date <= monthEndKey).length;

                return (
                  <div key={monthName} className="rounded-md border border-border/70 p-3">
                    <p className="font-medium capitalize">{monthName}</p>
                    <p className="text-sm text-muted-foreground">{monthCount} mission(s)</p>
                    <Button
                      className="mt-3"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCursor(monthStart);
                        setView("month");
                      }}
                    >
                      Ouvrir le mois
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card id="section-filters" className="xl:sticky xl:top-24">
          <CardHeader className="space-y-2 pb-3">
            <CardTitle className="text-lg">Filtres</CardTitle>
            <CardDescription className="text-xs">
              Filtre la vue calendrier ici. Ces mêmes filtres sont disponibles dans la fenêtre d&apos;ajout.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form
              className="space-y-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const formEl = event.currentTarget;
                const form = new FormData(formEl);
                const name = String(form.get("name") ?? "");
                const criteria = String(form.get("criteria") ?? "");
                try {
                  const usedColors = new Set(
                    calendarFilters.map((filter) => filter.color || inferCalendarFilterColor(filter.name, filter.criteria ?? "")),
                  );
                  await createFilter({
                    name,
                    color: pickDistinctFilterColor(name, criteria, usedColors),
                    criteria,
                  });
                  formEl.reset();
                  toast.success("Filtre ajouté.");
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Impossible d'ajouter ce filtre.";
                  toast.error(message);
                }
              }}
            >
              <Input name="name" placeholder="Nom (ex: Vente)" required className="h-8" />
              <Input name="criteria" placeholder="Critère (optionnel)" className="h-8" />
              <Button type="submit" size="sm" className="w-full">Ajouter</Button>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{calendarFilters.length} filtre(s)</Badge>
              <Badge variant="secondary">{activeFilterIds.length} actif(s)</Badge>
            </div>

            <div className="space-y-1.5">
              {calendarFilters.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun filtre pour le moment.</p>
              ) : (
                calendarFilters.map((filter) => {
                  const effectiveColor = filter.color || inferCalendarFilterColor(filter.name, filter.criteria ?? "");
                  const isActive = activeFilterIds.includes(filter._id);
                  const usageCount = filterUsageById.get(filter._id) ?? 0;
                  return (
                    <div
                      key={filter._id}
                      className="flex items-center gap-2 rounded-md border px-2 py-1.5"
                      style={{
                        borderColor: `color-mix(in oklch, ${effectiveColor} 60%, white)`,
                        backgroundColor: isActive
                          ? `color-mix(in oklch, ${effectiveColor} 22%, white)`
                          : `color-mix(in oklch, ${effectiveColor} 10%, white)`,
                      }}
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        onClick={() =>
                          setActiveFilterIds((current) =>
                            current.includes(filter._id)
                              ? current.filter((id) => id !== filter._id)
                              : [...current, filter._id],
                          )
                        }
                      >
                        {isActive ? <Check className="h-3.5 w-3.5 shrink-0" /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: effectiveColor }} />}
                        <span className="truncate text-sm font-medium">{filter.name}</span>
                      </button>
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{usageCount}</Badge>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={async () => {
                          if (!window.confirm(`Supprimer le filtre "${filter.name}" ?`)) return;
                          try {
                            const result = await deleteFilter({ filterId: filter._id });
                            setActiveFilterIds((current) => current.filter((id) => id !== filter._id));
                            setCreateFilterIds((current) => current.filter((id) => id !== filter._id));
                            toast.success(`Filtre supprimé (${result.removedTaskLinks} mission(s) mises à jour).`);
                          } catch (error) {
                            const message = error instanceof Error ? error.message : "Impossible de supprimer ce filtre.";
                            toast.error(message);
                          }
                        }}
                        aria-label={`Supprimer le filtre ${filter.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </aside>

      <Dialog
        open={!!selectedTask}
        onOpenChange={(open) => {
          if (open) return;
          setSelectedTaskId(null);
          setIsTaskEditing(false);
          setIsTaskSaving(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
            <DialogDescription>
              {selectedTask?.date} • {selectedTask?.startTime} - {selectedTask?.endTime}
            </DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-end">
                {!isTaskEditing ? (
                  <Button size="sm" variant="outline" onClick={openTaskEdit}>
                    Modifier
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsTaskEditing(false);
                      setIsTaskSaving(false);
                    }}
                  >
                    Annuler
                  </Button>
                )}
              </div>

              {!isTaskEditing ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: `color-mix(in oklch, ${accentForTask(selectedTask)} 65%, white)`,
                        backgroundColor: `color-mix(in oklch, ${accentForTask(selectedTask)} 20%, white)`,
                      }}
                    >
                      {TASK_ENTRY_TYPE_LABELS[normalizeEntryType(selectedTask.entryType)]}
                    </Badge>
                    <Badge variant="secondary">{TASK_STATUS_LABELS[selectedTask.status]}</Badge>
                    <Badge variant="outline">{TASK_PRIORITY_LABELS[selectedTask.priority]}</Badge>
                    {selectedTask.calendarFilterIds.map((filterId) => {
                      const color = filterColorById.get(filterId);
                      const label = filterNameById.get(filterId);
                      if (!color || !label) return null;
                      return (
                        <Badge
                          key={filterId}
                          variant="outline"
                          style={{
                            borderColor: `color-mix(in oklch, ${color} 65%, white)`,
                            backgroundColor: `color-mix(in oklch, ${color} 20%, white)`,
                          }}
                        >
                          {label}
                        </Badge>
                      );
                    })}
                    {selectedTask.dueDate ? <Badge variant="outline">Échéance: {selectedTask.dueDate}</Badge> : null}
                    {isAssignedToAnyProfile(selectedTask, sharedScopeProfileIds) ? (
                      <Badge variant="secondary">Assignée à moi</Badge>
                    ) : null}
                  </div>

                  {selectedTask.description ? (
                    <div>
                      <p className="font-medium">Description</p>
                      <p className="text-muted-foreground">{selectedTask.description}</p>
                    </div>
                  ) : null}

                  {selectedTask.note ? (
                    <div>
                      <p className="font-medium">Note</p>
                      <p className="text-muted-foreground whitespace-pre-wrap">{selectedTask.note}</p>
                    </div>
                  ) : null}

                  <div>
                    <p className="font-medium">Checklist</p>
                    {selectedTask.checklist.length === 0 ? (
                      <p className="text-muted-foreground">Aucun élément.</p>
                    ) : (
                      <ul className="space-y-1">
                        {selectedTask.checklist.map((item) => (
                          <li key={item.id} className="text-muted-foreground">
                            {item.done ? "[x]" : "[ ]"} {item.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                <form
                  key={taskEditFormNonce}
                  className="grid gap-3 md:grid-cols-2"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    const title = String(form.get("title") ?? "").trim();
                    if (!title) {
                      toast.error("Le titre est requis.");
                      return;
                    }

                    try {
                      setIsTaskSaving(true);
                      await updateTask({
                        taskId: selectedTask._id,
                        title,
                        description: String(form.get("description") ?? ""),
                        note: String(form.get("note") ?? ""),
                        date: String(form.get("date") ?? selectedTask.date),
                        dueDate: String(form.get("dueDate") ?? ""),
                        startTime: String(form.get("startTime") ?? selectedTask.startTime),
                        endTime: String(form.get("endTime") ?? selectedTask.endTime),
                        status: taskEditStatus,
                        priority: taskEditPriority,
                        entryType: taskEditEntryType,
                        calendarFilterIds: taskEditFilterIds as never,
                      });
                      toast.success("Mission modifiée.");
                      setIsTaskEditing(false);
                    } catch (error) {
                      const message = error instanceof Error ? error.message : "Impossible de modifier cette mission.";
                      toast.error(message);
                    } finally {
                      setIsTaskSaving(false);
                    }
                  }}
                >
                  <div className="space-y-1 md:col-span-2">
                    <Label>Titre</Label>
                    <Input name="title" defaultValue={selectedTask.title} required />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Description</Label>
                    <Input name="description" defaultValue={selectedTask.description ?? ""} />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Note</Label>
                    <Textarea name="note" defaultValue={selectedTask.note ?? ""} />
                  </div>
                  <div className="space-y-1">
                    <Label>Date</Label>
                    <Input name="date" type="date" defaultValue={selectedTask.date} />
                  </div>
                  <div className="space-y-1">
                    <Label>Échéance</Label>
                    <Input name="dueDate" type="date" defaultValue={selectedTask.dueDate ?? ""} />
                  </div>
                  <div className="space-y-1">
                    <Label>Début</Label>
                    <Input name="startTime" type="time" defaultValue={selectedTask.startTime} />
                  </div>
                  <div className="space-y-1">
                    <Label>Fin</Label>
                    <Input name="endTime" type="time" defaultValue={selectedTask.endTime} />
                  </div>
                  <div className="space-y-1">
                    <Label>Statut</Label>
                    <Select value={taskEditStatus} onValueChange={(value) => setTaskEditStatus(value as typeof taskEditStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Priorité</Label>
                    <Select value={taskEditPriority} onValueChange={(value) => setTaskEditPriority(value as typeof taskEditPriority)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(TASK_PRIORITIES).map((value) => (
                          <SelectItem key={value} value={value}>{TASK_PRIORITY_LABELS[value]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Type</Label>
                    <Select value={taskEditEntryType} onValueChange={(value) => setTaskEditEntryType(value as TaskEntryType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TASK_ENTRY_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Filtres</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setTaskEditFilterIds([])}
                      >
                        Aucun filtre
                      </Button>
                    </div>
                    {calendarFilters.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Aucun filtre créé.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 rounded-md border border-border/70 bg-muted/20 p-2">
                        {calendarFilters.map((filter) => {
                          const color = filter.color || inferCalendarFilterColor(filter.name, filter.criteria ?? "");
                          const selected = taskEditFilterIds.includes(filter._id);
                          return (
                            <button
                              key={filter._id}
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                              style={{
                                borderColor: `color-mix(in oklch, ${color} 65%, white)`,
                                backgroundColor: selected
                                  ? `color-mix(in oklch, ${color} 24%, white)`
                                  : `color-mix(in oklch, ${color} 10%, white)`,
                              }}
                              onClick={() =>
                                setTaskEditFilterIds((current) =>
                                  current.includes(filter._id)
                                    ? current.filter((id) => id !== filter._id)
                                    : [...current, filter._id],
                                )
                              }
                            >
                              {selected ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />}
                              {filter.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" className="w-full" disabled={isTaskSaving || isTaskDeleting}>
                      {isTaskSaving ? "Enregistrement..." : "Enregistrer les modifications"}
                    </Button>
                  </div>
                  <div className="md:col-span-2">
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full"
                      disabled={isTaskSaving || isTaskDeleting}
                      onClick={async () => {
                        const entryLabel = TASK_ENTRY_TYPE_LABELS[normalizeEntryType(selectedTask.entryType)].toLowerCase();
                        if (!window.confirm(`Supprimer cette ${entryLabel} ? Cette action est irréversible.`)) {
                          return;
                        }
                        try {
                          setIsTaskDeleting(true);
                          await deleteTask({ taskId: selectedTask._id });
                          toast.success("Élément supprimé.");
                          setSelectedTaskId(null);
                          setIsTaskEditing(false);
                        } catch (error) {
                          const message = error instanceof Error ? error.message : "Impossible de supprimer cet élément.";
                          toast.error(message);
                        } finally {
                          setIsTaskDeleting(false);
                        }
                      }}
                    >
                      {isTaskDeleting ? "Suppression..." : "Supprimer l'élément"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
