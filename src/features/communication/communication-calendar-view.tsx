"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarPlus2, ChevronLeft, ChevronRight, Filter, Megaphone } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import {
  EDITORIAL_EVENT_CATEGORIES,
  EDITORIAL_EVENT_CATEGORY_LABELS,
  EDITORIAL_EVENT_PRIORITIES,
  EDITORIAL_EVENT_PRIORITY_LABELS,
  EDITORIAL_EVENT_STATUSES,
  EDITORIAL_EVENT_STATUS_LABELS,
} from "@/lib/domain-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { EditorialEventCreateDialog } from "@/features/communication/editorial-event-create-dialog";

type CalendarView = "day" | "week" | "month" | "year";
type IsoDate = `${number}-${string}-${string}`;

type CalendarRange = {
  startDate: IsoDate;
  endDate: IsoDate;
};

const WEEKDAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function toIsoDate(date: Date): IsoDate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day, 12, 0, 0, 0);
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
    return { startDate: toIsoDate(startOfWeekMonday(cursor)), endDate: toIsoDate(endOfWeekMonday(cursor)) };
  }
  if (view === "year") {
    return { startDate: toIsoDate(startOfYear(cursor)), endDate: toIsoDate(endOfYear(cursor)) };
  }
  return { startDate: toIsoDate(startOfMonth(cursor)), endDate: toIsoDate(endOfMonth(cursor)) };
}

function moveCursor(base: Date, view: CalendarView, direction: -1 | 1) {
  if (view === "day") return addDays(base, direction);
  if (view === "week") return addDays(base, direction * 7);
  if (view === "month") return new Date(base.getFullYear(), base.getMonth() + direction, base.getDate(), 12);
  return new Date(base.getFullYear() + direction, base.getMonth(), base.getDate(), 12);
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

function dateLabel(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("fr-FR", options).format(date);
}

function compactDate(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function CommunicationCalendarView() {
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState<Date>(atNoon(new Date()));
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const profiles = useQuery(api.profiles.listVisibleProfiles);
  const currentProfile = useQuery(api.profiles.getCurrentProfile);

  const [category, setCategory] = useState<"all" | (typeof EDITORIAL_EVENT_CATEGORIES)[keyof typeof EDITORIAL_EVENT_CATEGORIES]>("all");
  const [status, setStatus] = useState<"all" | (typeof EDITORIAL_EVENT_STATUSES)[keyof typeof EDITORIAL_EVENT_STATUSES]>("all");
  const [priority, setPriority] = useState<"all" | (typeof EDITORIAL_EVENT_PRIORITIES)[keyof typeof EDITORIAL_EVENT_PRIORITIES]>("all");
  const [ownerProfileId, setOwnerProfileId] = useState<string>("all");

  const range = useMemo(() => getRange(view, cursor), [view, cursor]);
  const cursorIso = useMemo(() => toIsoDate(cursor), [cursor]);

  const events = useQuery(api.communication.listEditorialEventsInRange, {
    startDate: range.startDate,
    endDate: range.endDate,
    category: category === "all" ? undefined : category,
    status: status === "all" ? undefined : status,
    priority: priority === "all" ? undefined : priority,
    ownerProfileId: ownerProfileId === "all" ? undefined : (ownerProfileId as never),
  });

  const profileNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const profile of profiles ?? []) {
      map.set(profile._id, profile.displayName);
    }
    return map;
  }, [profiles]);

  const activeFilterCount = useMemo(() => {
    return [category !== "all", status !== "all", priority !== "all", ownerProfileId !== "all"].filter(Boolean).length;
  }, [category, status, priority, ownerProfileId]);

  const periodLabel = useMemo(() => {
    if (view === "day") {
      return dateLabel(cursor, { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    }
    if (view === "week") {
      const start = startOfWeekMonday(cursor);
      const end = endOfWeekMonday(cursor);
      const startLabel = dateLabel(start, { day: "2-digit", month: "short" });
      const endLabel = dateLabel(end, { day: "2-digit", month: "short", year: "numeric" });
      return `Semaine du ${startLabel} au ${endLabel}`;
    }
    if (view === "year") {
      return String(cursor.getFullYear());
    }
    return dateLabel(cursor, { month: "long", year: "numeric" });
  }, [view, cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, NonNullable<typeof events>>();
    const start = fromIsoDate(range.startDate);
    const end = fromIsoDate(range.endDate);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 3600 * 1000)) + 1);
    for (let i = 0; i < days; i += 1) {
      const iso = toIsoDate(addDays(start, i));
      map.set(iso, []);
    }
    for (const event of events ?? []) {
      const eventStart = event.startDate as IsoDate;
      const eventEnd = (event.endDate ?? event.startDate) as IsoDate;
      const overlapStart = eventStart > range.startDate ? eventStart : range.startDate;
      const overlapEnd = eventEnd < range.endDate ? eventEnd : range.endDate;
      if (overlapEnd < overlapStart) continue;
      const overlapStartDate = fromIsoDate(overlapStart);
      const overlapEndDate = fromIsoDate(overlapEnd);
      const spanDays = Math.max(
        1,
        Math.round((overlapEndDate.getTime() - overlapStartDate.getTime()) / (24 * 3600 * 1000)) + 1,
      );
      for (let i = 0; i < spanDays; i += 1) {
        const iso = toIsoDate(addDays(overlapStartDate, i));
        const bucket = map.get(iso);
        if (bucket) bucket.push(event);
      }
    }
    for (const [key, list] of map.entries()) {
      map.set(
        key,
        list.slice().sort((a, b) => {
          if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
          return a.title.localeCompare(b.title);
        }),
      );
    }
    return map;
  }, [events, range.startDate, range.endDate]);

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return (events ?? []).find((event) => event._id === selectedEventId) ?? null;
  }, [events, selectedEventId]);

  const dayEvents = useMemo(() => eventsByDay.get(cursorIso) ?? [], [eventsByDay, cursorIso]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <Card id="section-agenda">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-primary" />
                  Calendrier éditorial
                </CardTitle>
                <Badge variant="secondary">{activeFilterCount} filtre(s) actif(s)</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => setCreateOpen(true)}>
                  <CalendarPlus2 className="mr-2 h-4 w-4" />
                  Ajouter
                </Button>
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
                <Button variant="outline" onClick={() => setCursor(atNoon(new Date()))}>
                  Aujourd&apos;hui
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCategory("all");
                      setStatus("all");
                      setPriority("all");
                      setOwnerProfileId("all");
                    }}
                  >
                    Effacer filtres
                  </Button>
                ) : null}
                <CardDescription className="text-sm font-medium text-foreground">{periodLabel}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {view === "day" ? (
              <div className="space-y-3">
                {dayEvents.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground">
                    Aucun événement ce jour.
                  </p>
                ) : (
                  dayEvents.map((event) => (
                    <button
                      key={event._id}
                      className="w-full rounded-lg border border-border/70 bg-background/70 p-3 text-left hover:bg-primary/5"
                      onClick={() => setSelectedEventId(event._id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{event.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Start: {compactDate(event.startDate)} • Prep: {compactDate(event.prepStartDate)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Badge variant="secondary">{EDITORIAL_EVENT_STATUS_LABELS[event.status]}</Badge>
                          <Badge variant="outline">{EDITORIAL_EVENT_CATEGORY_LABELS[event.category]}</Badge>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : null}

            {view === "week" ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
                {weekDays(cursor).map((day) => {
                  const iso = toIsoDate(day);
                  const dayList = eventsByDay.get(iso) ?? [];
                  const isToday = iso === toIsoDate(atNoon(new Date()));
                  const isCursor = iso === cursorIso;
                  return (
                    <div
                      key={iso}
                      className={cn(
                        "rounded-lg border border-border/70 bg-background/70 p-2",
                        isToday && "border-primary/40 bg-primary/5",
                        isCursor && "ring-1 ring-primary/35",
                      )}
                    >
                      <button className="w-full text-left" onClick={() => setCursor(fromIsoDate(iso))}>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          {WEEKDAY_SHORT[(day.getDay() + 6) % 7]} {String(day.getDate()).padStart(2, "0")}
                        </p>
                      </button>
                      <div className="mt-2 space-y-1">
                        {dayList.length === 0 ? (
                          <p className="text-xs text-muted-foreground">-</p>
                        ) : (
                          dayList.slice(0, 6).map((event) => (
                            <button
                              key={event._id}
                              className="block w-full truncate rounded-md border border-border/70 bg-background px-2 py-1 text-left text-xs hover:bg-primary/5"
                              onClick={() => setSelectedEventId(event._id)}
                              title={event.title}
                            >
                              {event.title}
                            </button>
                          ))
                        )}
                        {dayList.length > 6 ? (
                          <p className="text-xs text-muted-foreground">+{dayList.length - 6} autre(s)</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {view === "month" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-7 gap-2">
                  {WEEKDAY_SHORT.map((label) => (
                    <p key={label} className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {label}
                    </p>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {monthGridDays(cursor).map((day) => {
                    const iso = toIsoDate(day);
                    const dayList = eventsByDay.get(iso) ?? [];
                    const inMonth = day.getMonth() === cursor.getMonth();
                    const isToday = iso === toIsoDate(atNoon(new Date()));
                    const isCursor = iso === cursorIso;
                    return (
                      <div
                        key={iso}
                        className={cn(
                          "min-h-[104px] rounded-lg border border-border/70 bg-background/70 p-2",
                          !inMonth && "opacity-55",
                          isToday && "border-primary/40 bg-primary/5",
                          isCursor && "ring-1 ring-primary/35",
                        )}
                      >
                        <button
                          className="flex w-full items-center justify-between gap-2 text-left"
                          onClick={() => setCursor(fromIsoDate(iso))}
                        >
                          <span className="text-sm font-medium">{day.getDate()}</span>
                          {dayList.length > 0 ? <Badge variant="secondary">{dayList.length}</Badge> : null}
                        </button>
                        <div className="mt-2 space-y-1">
                          {dayList.slice(0, 3).map((event) => (
                            <button
                              key={event._id}
                              className="block w-full truncate rounded-md border border-border/70 bg-background px-2 py-1 text-left text-xs hover:bg-primary/5"
                              onClick={() => setSelectedEventId(event._id)}
                              title={`${event.title} (Start ${event.startDate}, Prep ${event.prepStartDate})`}
                            >
                              {event.title}
                            </button>
                          ))}
                          {dayList.length > 3 ? (
                            <p className="text-xs text-muted-foreground">+{dayList.length - 3} autre(s)</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {view === "year" ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {yearMonths(cursor).map((month) => {
                  const monthStart = startOfMonth(month);
                  const monthEnd = endOfMonth(month);
                  const startIso = toIsoDate(monthStart);
                  const endIso = toIsoDate(monthEnd);
                  const allMonthEvents =
                    (events ?? []).filter((event) => {
                      const eventStart = event.startDate as IsoDate;
                      const eventEnd = (event.endDate ?? event.startDate) as IsoDate;
                      return eventStart <= endIso && eventEnd >= startIso;
                    }) ?? [];

                  return (
                    <div key={startIso} className="rounded-lg border border-border/70 bg-background/70 p-3">
                      <button className="w-full text-left" onClick={() => setCursor(monthStart)}>
                        <p className="flex items-center justify-between gap-2 font-medium">
                          <span>{dateLabel(month, { month: "long" })}</span>
                          <Badge variant="secondary">{allMonthEvents.length}</Badge>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {dateLabel(month, { year: "numeric" })}
                        </p>
                      </button>
                      <div className="mt-3 space-y-1">
                        {allMonthEvents.length === 0 ? (
                          <p className="text-xs text-muted-foreground">-</p>
                        ) : (
                          allMonthEvents.slice(0, 5).map((event) => (
                            <button
                              key={event._id}
                              className="block w-full truncate rounded-md border border-border/70 bg-background px-2 py-1 text-left text-xs hover:bg-primary/5"
                              onClick={() => setSelectedEventId(event._id)}
                              title={event.title}
                            >
                              {event.title}
                            </button>
                          ))
                        )}
                        {allMonthEvents.length > 5 ? (
                          <p className="text-xs text-muted-foreground">+{allMonthEvents.length - 5} autre(s)</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-lg">Filtres</CardTitle>
            <CardDescription>Affiner la vue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Catégorie
            </Label>
            <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {Object.values(EDITORIAL_EVENT_CATEGORIES)
                  .filter((value) => value !== "marronnier")
                  .map((value) => (
                    <SelectItem key={value} value={value}>
                      {EDITORIAL_EVENT_CATEGORY_LABELS[value]}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Owner</Label>
            <Select value={ownerProfileId} onValueChange={setOwnerProfileId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tout le monde</SelectItem>
                {(profiles ?? []).map((profile) => (
                  <SelectItem key={profile._id} value={profile._id}>
                    {profile.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Statut</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {Object.values(EDITORIAL_EVENT_STATUSES).map((value) => (
                  <SelectItem key={value} value={value}>
                    {EDITORIAL_EVENT_STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Priorité</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {Object.values(EDITORIAL_EVENT_PRIORITIES).map((value) => (
                  <SelectItem key={value} value={value}>
                    {EDITORIAL_EVENT_PRIORITY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
              <p className="font-medium">Astuce</p>
              <p className="mt-1 text-muted-foreground">
                Clique un événement pour voir le détail (startDate + prepStartDate) et ouvrir la fiche.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-lg">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="secondary" asChild className="w-full">
              <Link href="/communication/events">Vue table (événements)</Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/communication">Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <EditorialEventCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultStartDate={cursorIso}
        defaultOwnerProfileId={currentProfile?._id}
        triggerLabel="Créer l'événement"
      />

      <Dialog
        open={!!selectedEventId}
        onOpenChange={(open) => {
          if (!open) setSelectedEventId(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Détail événement</DialogTitle>
            <DialogDescription>StartDate et PrepStartDate, puis accès à la fiche + tâches.</DialogDescription>
          </DialogHeader>
          {selectedEvent ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                <p className="text-lg font-semibold">{selectedEvent.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Owner: {profileNames.get(selectedEvent.ownerProfileId) ?? "Membre"}
                  {selectedEvent.backupOwnerProfileId
                    ? ` • Backup: ${profileNames.get(selectedEvent.backupOwnerProfileId) ?? "Membre"}`
                    : ""}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-border/70 bg-muted/15 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Start</p>
                  <p className="mt-1 font-medium">{compactDate(selectedEvent.startDate)}</p>
                  {selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.startDate ? (
                    <p className="mt-1 text-xs text-muted-foreground">Fin: {compactDate(selectedEvent.endDate)}</p>
                  ) : null}
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/15 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Préparation</p>
                  <p className="mt-1 font-medium">{compactDate(selectedEvent.prepStartDate)}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{EDITORIAL_EVENT_CATEGORY_LABELS[selectedEvent.category]}</Badge>
                <Badge variant="outline">{EDITORIAL_EVENT_PRIORITY_LABELS[selectedEvent.priority]}</Badge>
                <Badge variant="secondary">{EDITORIAL_EVENT_STATUS_LABELS[selectedEvent.status]}</Badge>
              </div>

              {selectedEvent.notes ? (
                <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Notes</p>
                  <p className="mt-1 whitespace-pre-line text-sm">{selectedEvent.notes}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href={`/communication/event/${selectedEvent._id}`}>Ouvrir la fiche</Link>
                </Button>
                <Button variant="secondary" onClick={() => setSelectedEventId(null)}>
                  Fermer
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
