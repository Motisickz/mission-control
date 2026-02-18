"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, CalendarDays, CircleAlert, ListChecks, PenSquare, Plus } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import { getWeekRange, todayIsoDate } from "@/lib/datetime";
import { TASK_ENTRY_TYPE_LABELS, TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, WEEKDAY_KEYS, WEEKDAY_LABELS } from "@/lib/domain-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function addDaysToIsoDate(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toWeekday(dateIso: string) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
  const weekday = date.getDay();
  if (weekday === 0) return "sun";
  if (weekday === 1) return "mon";
  if (weekday === 2) return "tue";
  if (weekday === 3) return "wed";
  if (weekday === 4) return "thu";
  if (weekday === 5) return "fri";
  return "sat";
}

export function MissionsWeeklyReminderView() {
  const week = getWeekRange(new Date());
  const tasks = useQuery(api.tasks.listCalendarRange, {
    startDate: week.start,
    endDate: week.end,
  });
  const templates = useQuery(api.tasksTemplates.listWeeklyReminderTemplates);
  const profiles = useQuery(api.profiles.listVisibleProfiles);
  const currentProfile = useQuery(api.profiles.getCurrentProfile);

  const createWeeklyTemplate = useMutation(api.tasksTemplates.createWeeklyReminderTemplate);
  const updateWeeklyTemplate = useMutation(api.tasksTemplates.updateWeeklyReminderTemplate);
  const generateWeeklyInstances = useMutation(api.tasksTemplates.generateWeeklyReminderInstances);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<"urgent" | "high" | "medium" | "low">("medium");
  const [weekday, setWeekday] = useState<(typeof WEEKDAY_KEYS)[number]>("mon");
  const [formNonce, setFormNonce] = useState(0);

  const pendingTasks = useMemo(
    () => (tasks ?? []).filter((task) => task.status !== "done"),
    [tasks],
  );

  const specialTasks = useMemo(
    () =>
      pendingTasks.filter((task) => {
        const entryType = task.entryType ?? "task";
        return entryType === "meeting" || entryType === "event";
      }),
    [pendingTasks],
  );

  const weeklyReminderCount = useMemo(
    () => pendingTasks.filter((task) => task.period === "weekly").length,
    [pendingTasks],
  );

  const groupedByDate = useMemo(() => {
    const map = new Map<string, typeof pendingTasks>();
    for (const task of pendingTasks) {
      const list = map.get(task.date) ?? [];
      map.set(task.date, [...list, task]);
    }
    for (const [date, list] of map.entries()) {
      map.set(date, list.slice().sort((a, b) => a.startTime.localeCompare(b.startTime)));
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [pendingTasks]);

  const weeklyTemplates = useMemo(() => templates ?? [], [templates]);
  const activeWeeklyTemplates = useMemo(
    () => weeklyTemplates.filter((template) => template.active).length,
    [weeklyTemplates],
  );

  const editTemplate = useMemo(
    () => weeklyTemplates.find((template) => template._id === editTemplateId) ?? null,
    [weeklyTemplates, editTemplateId],
  );

  const openCreateReminder = () => {
    const baseDate = todayIsoDate();
    setAssigneeId(currentProfile?._id ?? profiles?.[0]?._id ?? "");
    setPriority("medium");
    setWeekday(toWeekday(baseDate));
    setFormNonce((value) => value + 1);
    setCreateOpen(true);
  };

  useEffect(() => {
    if (!currentProfile) return;
    const horizonStart = todayIsoDate();
    const horizonEnd = addDaysToIsoDate(horizonStart, 84);
    void generateWeeklyInstances({
      startDate: horizonStart,
      endDate: horizonEnd,
    });
  }, [currentProfile, generateWeeklyInstances]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden border-border/70 bg-card/90">
          <CardHeader className="relative flex flex-row items-start justify-between gap-4 pb-3">
            <div className="absolute -top-10 right-0 h-32 w-32 rounded-full bg-[color:oklch(0.9_0.08_340/.42)] blur-2xl" />
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <BellRing className="h-5 w-5 text-primary" />
                Rappel hebdomadaire
              </CardTitle>
              <CardDescription>
                Moteur de récurrence actif: template + génération automatique ({week.start} → {week.end}).
              </CardDescription>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <Button onClick={openCreateReminder}>
                <Plus className="mr-1.5 h-4 w-4" />
                Ajouter un rappel
              </Button>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Nouveau template de rappel hebdomadaire</DialogTitle>
                  <DialogDescription>
                    Ce rappel sera appliqué automatiquement chaque semaine selon la règle définie.
                  </DialogDescription>
                </DialogHeader>
                <form
                  key={formNonce}
                  className="grid gap-3 md:grid-cols-2"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const formEl = event.currentTarget;
                    const form = new FormData(formEl);
                    const title = String(form.get("title") ?? "").trim();
                    const description = String(form.get("description") ?? "").trim();
                    const startDate = String(form.get("startDate") ?? todayIsoDate());
                    const endDateRaw = String(form.get("endDate") ?? "").trim();
                    const startTime = String(form.get("startTime") ?? "09:00");
                    const endTime = String(form.get("endTime") ?? "09:30");
                    const assignee = assigneeId || currentProfile?._id || profiles?.[0]?._id || "";
                    if (!title || !assignee) return;

                    try {
                      await createWeeklyTemplate({
                        title,
                        description,
                        weekday,
                        startDate,
                        endDate: endDateRaw || undefined,
                        startTime,
                        endTime,
                        assigneeProfileId: assignee as never,
                        priority,
                      });

                      const horizonStart = todayIsoDate();
                      const horizonEnd = addDaysToIsoDate(horizonStart, 84);
                      await generateWeeklyInstances({
                        startDate: horizonStart,
                        endDate: horizonEnd,
                      });

                      formEl.reset();
                      setPriority("medium");
                      setWeekday(toWeekday(todayIsoDate()));
                      setAssigneeId(currentProfile?._id ?? profiles?.[0]?._id ?? "");
                      setFormNonce((value) => value + 1);
                      setCreateOpen(false);
                      toast.success("Template hebdomadaire créé et planifié automatiquement.");
                    } catch (error) {
                      const message = error instanceof Error ? error.message : "Impossible d'ajouter ce rappel.";
                      toast.error(message);
                    }
                  }}
                >
                  <div className="space-y-1 md:col-span-2">
                    <Label>Titre</Label>
                    <Input name="title" required placeholder="Revue hebdomadaire commerciale" />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Description</Label>
                    <Input name="description" placeholder="Objectif rapide du rappel" />
                  </div>
                  <div className="space-y-1">
                    <Label>Assigné(e)</Label>
                    <Select value={assigneeId} onValueChange={setAssigneeId}>
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
                  <div className="space-y-1">
                    <Label>Priorité</Label>
                    <Select value={priority} onValueChange={(value) => setPriority(value as typeof priority)}>
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
                  <div className="space-y-1">
                    <Label>Jour de rappel</Label>
                    <Select value={weekday} onValueChange={(value) => setWeekday(value as typeof weekday)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAY_KEYS.map((key) => (
                          <SelectItem key={key} value={key}>{WEEKDAY_LABELS[key]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Date de début</Label>
                    <Input name="startDate" type="date" defaultValue={todayIsoDate()} />
                  </div>
                  <div className="space-y-1">
                    <Label>Date de fin (optionnelle)</Label>
                    <Input name="endDate" type="date" />
                  </div>
                  <div className="space-y-1">
                    <Label>Début</Label>
                    <Input name="startTime" type="time" defaultValue="09:00" />
                  </div>
                  <div className="space-y-1">
                    <Label>Fin</Label>
                    <Input name="endTime" type="time" defaultValue="09:30" />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" className="w-full">
                      Enregistrer la règle hebdomadaire
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Modifie une règle, puis le moteur régénère automatiquement les prochaines occurrences.
            </p>
                  <div className="space-y-2">
              {weeklyTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun template hebdomadaire configuré.</p>
              ) : (
                weeklyTemplates.map((template) => (
                  <div key={template._id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 p-2.5">
                    <div>
                      <p className="text-sm font-medium">
                        {template.title}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({template.active ? "Actif" : "Suspendu"})
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {template.weekday ? WEEKDAY_LABELS[template.weekday] : "Jour non défini"} • {template.startTime} - {template.endTime}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setEditTemplateId(template._id)}>
                      <PenSquare className="mr-1.5 h-3.5 w-3.5" />
                      Modifier
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle className="text-lg">État rapide</CardTitle>
            <CardDescription>Lecture immédiate de la charge à venir.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><ListChecks className="h-4 w-4" /> Missions ouvertes</p>
              <p className="mt-1 text-2xl font-semibold">{pendingTasks.length}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><CircleAlert className="h-4 w-4" /> Spéciales (agenda)</p>
              <p className="mt-1 text-2xl font-semibold">{specialTasks.length}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><BellRing className="h-4 w-4" /> Rappels hebdo actifs</p>
              <p className="mt-1 text-2xl font-semibold">{activeWeeklyTemplates}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><BellRing className="h-4 w-4" /> Occurrences cette semaine</p>
              <p className="mt-1 text-2xl font-semibold">{weeklyReminderCount}</p>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/calendrier">
                <CalendarDays className="mr-1.5 h-4 w-4" />
                Ouvrir le calendrier
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Timeline de la semaine</CardTitle>
          <CardDescription>Vue structurée par jour pour ne rien rater.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {groupedByDate.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground">
              Aucune mission ouverte sur cette semaine.
            </p>
          ) : (
            groupedByDate.map(([date, items]) => (
              <div key={date} className="rounded-lg border border-border/70 p-3">
                <p className="mb-2 text-sm font-semibold">{date}</p>
                <div className="space-y-2">
                  {items.map((task) => {
                    const entryType = task.entryType ?? "task";
                    return (
                      <article key={task._id} className="rounded-md border border-border/70 bg-background/70 p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{task.title}</p>
                            <p className="text-sm text-muted-foreground">{task.startTime} - {task.endTime}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {task.period === "weekly" ? <Badge variant="outline">Rappel hebdo</Badge> : null}
                            <Badge variant="outline">{TASK_ENTRY_TYPE_LABELS[entryType]}</Badge>
                            <Badge variant="secondary">{TASK_STATUS_LABELS[task.status]}</Badge>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!editTemplate}
        onOpenChange={(open) => {
          if (!open) setEditTemplateId(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Modifier la règle hebdomadaire</DialogTitle>
            <DialogDescription>
              Mets à jour la règle, puis régénère automatiquement les prochaines occurrences.
            </DialogDescription>
          </DialogHeader>
          {editTemplate ? (
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const title = String(form.get("title") ?? "").trim();
                const description = String(form.get("description") ?? "").trim();
                const startDate = String(form.get("startDate") ?? editTemplate.startDate ?? todayIsoDate());
                const endDateRaw = String(form.get("endDate") ?? "").trim();
                const startTime = String(form.get("startTime") ?? editTemplate.startTime);
                const endTime = String(form.get("endTime") ?? editTemplate.endTime);
                const weekdayValue = String(form.get("weekday") ?? editTemplate.weekday ?? "mon");
                const activeValue = String(form.get("active") ?? "true") === "true";

                try {
                  await updateWeeklyTemplate({
                    templateId: editTemplate._id,
                    title,
                    description,
                    weekday: weekdayValue as never,
                    startDate,
                    endDate: endDateRaw,
                    startTime,
                    endTime,
                    priority: String(form.get("priority") ?? editTemplate.priority) as never,
                    active: activeValue,
                  });

                  const horizonStart = todayIsoDate();
                  const horizonEnd = addDaysToIsoDate(horizonStart, 84);
                  await generateWeeklyInstances({
                    startDate: horizonStart,
                    endDate: horizonEnd,
                  });

                  toast.success("Règle hebdomadaire mise à jour.");
                  setEditTemplateId(null);
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Impossible de modifier cette règle.";
                  toast.error(message);
                }
              }}
            >
              <div className="space-y-1 md:col-span-2">
                <Label>Titre</Label>
                <Input name="title" defaultValue={editTemplate.title} required />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Description</Label>
                <Input name="description" defaultValue={editTemplate.description ?? ""} />
              </div>
              <div className="space-y-1">
                <Label>Jour</Label>
                <Select name="weekday" defaultValue={editTemplate.weekday ?? "mon"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_KEYS.map((key) => (
                      <SelectItem key={key} value={key}>{WEEKDAY_LABELS[key]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Priorité</Label>
                <Select name="priority" defaultValue={editTemplate.priority}>
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
              <div className="space-y-1">
                <Label>Date de début</Label>
                <Input name="startDate" type="date" defaultValue={editTemplate.startDate ?? todayIsoDate()} />
              </div>
              <div className="space-y-1">
                <Label>Date de fin (optionnelle)</Label>
                <Input name="endDate" type="date" defaultValue={editTemplate.endDate ?? ""} />
              </div>
              <div className="space-y-1">
                <Label>Début</Label>
                <Input name="startTime" type="time" defaultValue={editTemplate.startTime} />
              </div>
              <div className="space-y-1">
                <Label>Fin</Label>
                <Input name="endTime" type="time" defaultValue={editTemplate.endTime} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Statut</Label>
                <Select name="active" defaultValue={editTemplate.active ? "true" : "false"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Actif</SelectItem>
                    <SelectItem value="false">Suspendu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Button type="submit" className="w-full">Enregistrer les modifications</Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
