"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import {
  CALENDAR_FILTER_COLOR_RULES,
  CALENDAR_FILTER_DEFAULT_COLOR,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/domain-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

function normalizeFilterName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function CalendrierView() {
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState<Date>(atNoon(new Date()));
  const [createPriority, setCreatePriority] = useState<"urgent" | "medium" | "low">("medium");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const range = useMemo(() => getRange(view, cursor), [view, cursor]);

  const queriedTasks = useQuery(api.tasks.listCalendarRange, range);
  const tasks = useMemo(() => queriedTasks ?? [], [queriedTasks]);
  const filters = useQuery(api.calendar.list);
  const uniqueFilters = useMemo(() => {
    const source = filters ?? [];
    const seen = new Set<string>();
    return source.filter((filter) => {
      const key = normalizeFilterName(filter.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [filters]);
  const profiles = useQuery(api.profiles.listVisibleProfiles);
  const createFilter = useMutation(api.calendar.createFilter);
  const createTask = useMutation(api.tasks.createTask);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    for (const task of tasks) {
      const key = task.date;
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    for (const [key, list] of map.entries()) {
      map.set(key, [...list].sort((a, b) => a.startTime.localeCompare(b.startTime)));
    }
    return map;
  }, [tasks]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task._id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  const dayTasks = tasksByDate.get(dateKey(cursor)) ?? [];

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtres calendrier</CardTitle>
          <CardDescription>Vue type agenda avec filtres personnalisables.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3 md:flex-row"
            onSubmit={async (event) => {
              event.preventDefault();
              const formEl = event.currentTarget;
              const form = new FormData(formEl);
              const name = String(form.get("name") ?? "");
              const criteria = String(form.get("criteria") ?? "");
              try {
                await createFilter({
                  name,
                  color: inferCalendarFilterColor(name, criteria),
                  criteria,
                });
                formEl.reset();
              } catch (error) {
                const message = error instanceof Error ? error.message : "Impossible d'ajouter ce filtre.";
                toast.error(message);
              }
            }}
          >
            <Input name="name" placeholder="Nom du filtre" required />
            <Input name="criteria" placeholder="Critère" />
            <Button type="submit">Ajouter un filtre</Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {uniqueFilters.map((filter) => {
              const effectiveColor = inferCalendarFilterColor(filter.name, filter.criteria ?? "");
              return (
                <Badge
                  key={filter._id}
                  variant="outline"
                  className="gap-1.5 border-transparent"
                  style={{
                    borderColor: `color-mix(in oklch, ${effectiveColor} 65%, white)`,
                    backgroundColor: `color-mix(in oklch, ${effectiveColor} 22%, white)`,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: effectiveColor }}
                  />
                  {filter.name}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Missions planifiées</CardTitle>
            <CardDescription>
              Crée une nouvelle mission en pop-up sans perdre la vue calendrier.
            </CardDescription>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>Ajouter une nouvelle tâche</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nouvelle mission</DialogTitle>
                <DialogDescription>
                  Tâche complète avec date, échéance, note et assignation.
                </DialogDescription>
              </DialogHeader>
              <form
                className="grid gap-3 md:grid-cols-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const formEl = event.currentTarget;
                  const form = new FormData(formEl);
                  const assignee = String(form.get("assignee") ?? "");
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
                    checklist: [],
                    calendarFilterIds: [],
                  });

                  formEl.reset();
                  setCreateOpen(false);
                }}
              >
                <div className="space-y-1">
                  <Label>Titre</Label>
                  <Input name="title" required />
                </div>
                <div className="space-y-1">
                  <Label>Assigné(e)</Label>
                  <Select name="assignee" required>
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
                <div className="space-y-1">
                  <Label>Date mission</Label>
                  <DatePillPicker name="date" defaultValue={toIsoDate(new Date())} />
                </div>
                <div className="space-y-1">
                  <Label>Échéance</Label>
                  <DatePillPicker name="dueDate" defaultValue={toIsoDate(new Date())} />
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
                <div className="md:col-span-2">
                  <Button type="submit" className="w-full">Ajouter la mission au calendrier</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>Calendrier</CardTitle>
            <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)}>
                <TabsList>
                  <TabsTrigger value="day">Jour</TabsTrigger>
                  <TabsTrigger value="week">Semaine</TabsTrigger>
                  <TabsTrigger value="month">Mois</TabsTrigger>
                  <TabsTrigger value="year">Année</TabsTrigger>
                </TabsList>
            </Tabs>
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
            <CardDescription className="text-sm font-medium text-foreground">{periodLabel}</CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {view === "day" && (
            <div className="space-y-4">
              <div className="rounded-md border border-border/70 p-3">
                <p className="mb-2 text-sm font-medium">Répertoire des missions de la journée</p>
                {dayTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune mission sur cette date.</p>
                ) : (
                  <div className="space-y-2">
                    {dayTasks.map((task) => (
                      <button
                        key={task._id}
                        className="w-full rounded-md border border-border/70 p-3 text-left hover:bg-primary/5"
                        onClick={() => setSelectedTaskId(task._id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{task.title}</p>
                          <Badge variant="secondary">{TASK_STATUS_LABELS[task.status]}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{task.startTime} - {task.endTime}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {view === "week" && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
              {weekDays(cursor).map((day) => {
                const key = dateKey(day);
                const list = tasksByDate.get(key) ?? [];
                return (
                  <div
                    key={key}
                    className="cursor-pointer rounded-md border border-border/70 p-2 text-left"
                    onClick={() => {
                      setCursor(day);
                      setView("day");
                    }}
                  >
                    <p className="text-xs text-muted-foreground">{WEEKDAY_SHORT[(day.getDay() + 6) % 7]}</p>
                    <p className="mb-2 text-sm font-medium">{dateLabel(day, { day: "2-digit", month: "2-digit" })}</p>
                    <div className="space-y-1">
                      {list.slice(0, 5).map((task) => (
                        <button
                          key={task._id}
                          className="block w-full rounded bg-primary/10 px-2 py-1 text-left text-xs hover:bg-primary/20"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedTaskId(task._id);
                          }}
                        >
                          <p className="truncate font-medium">{task.title}</p>
                          <p className="text-muted-foreground">{task.startTime}</p>
                        </button>
                      ))}
                      {list.length > 5 && <p className="text-xs text-muted-foreground">+{list.length - 5} autres</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {view === "month" && (
            <div className="space-y-2">
              <div className="grid grid-cols-7 gap-2">
                {WEEKDAY_SHORT.map((label) => (
                  <p key={label} className="px-1 text-xs font-medium text-muted-foreground">{label}</p>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {monthGridDays(cursor).map((day) => {
                  const currentMonth = day.getMonth() === cursor.getMonth();
                  const key = dateKey(day);
                  const list = tasksByDate.get(key) ?? [];

                  return (
                    <div
                      key={key}
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
                        {list.slice(0, 3).map((task) => (
                          <button
                            key={task._id}
                            className="block w-full truncate rounded bg-primary/10 px-1.5 py-0.5 text-left text-[11px] hover:bg-primary/20"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedTaskId(task._id);
                            }}
                          >
                            {task.startTime} {task.title}
                          </button>
                        ))}
                        {list.length > 3 && <p className="text-[11px] text-muted-foreground">+{list.length - 3} autres</p>}
                      </div>
                    </div>
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
                const monthCount = tasks.filter((task) => task.date >= monthStartKey && task.date <= monthEndKey).length;

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

      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
            <DialogDescription>
              {selectedTask?.date} • {selectedTask?.startTime} - {selectedTask?.endTime}
            </DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{TASK_STATUS_LABELS[selectedTask.status]}</Badge>
                <Badge variant="outline">{TASK_PRIORITY_LABELS[selectedTask.priority]}</Badge>
                {selectedTask.dueDate ? <Badge variant="outline">Échéance: {selectedTask.dueDate}</Badge> : null}
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
