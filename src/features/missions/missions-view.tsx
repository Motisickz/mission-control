"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus2, CircleAlert, CircleCheckBig, Clock3, Plus } from "lucide-react";
import { useMutation, useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { formatDateLabel, formatWeekday, todayIsoDate } from "@/lib/datetime";
import {
  PERIOD_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/domain-constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePillPicker } from "@/components/ui/date-pill-picker";

type TaskFilter = "all" | "urgent" | "mine";

export function MissionsView() {
  const daily = useQuery(api.missions.missionOverview, { period: "daily" });
  const weekly = useQuery(api.missions.missionOverview, { period: "weekly" });
  const monthly = useQuery(api.missions.missionOverview, { period: "monthly" });
  const profiles = useQuery(api.profiles.listVisibleProfiles);
  const currentProfile = useQuery(api.profiles.getCurrentProfile);
  const createTask = useMutation(api.tasks.createTask);
  const updateTask = useMutation(api.tasks.updateTask);

  const [priority, setPriority] = useState<"urgent" | "medium" | "low">("medium");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "none">("daily");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const sections = [daily, weekly, monthly].filter(
    (section): section is NonNullable<typeof section> => section !== undefined,
  );

  const allTasks = useMemo(() => {
    const map = new Map<string, (typeof sections)[number]["tasks"][number]>();
    for (const section of sections) {
      for (const task of section.tasks) {
        map.set(task._id, task);
      }
    }
    return [...map.values()].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });
  }, [sections]);

  const today = todayIsoDate();
  const tasksToday = useMemo(
    () => allTasks.filter((task) => task.date === today),
    [allTasks, today],
  );
  const completedToday = useMemo(
    () => tasksToday.filter((task) => task.status === "done"),
    [tasksToday],
  );
  const openToday = useMemo(
    () => tasksToday.filter((task) => task.status !== "done"),
    [tasksToday],
  );
  const urgentToday = useMemo(
    () => openToday.filter((task) => task.priority === "urgent"),
    [openToday],
  );

  const filteredTodayTasks = useMemo(() => {
    if (taskFilter === "urgent") return tasksToday.filter((task) => task.priority === "urgent");
    if (taskFilter === "mine") {
      if (!currentProfile) return tasksToday;
      return tasksToday.filter((task) => task.assigneeProfileId === currentProfile._id);
    }
    return tasksToday;
  }, [taskFilter, tasksToday, currentProfile]);

  const dayProgress = tasksToday.length === 0
    ? 0
    : Math.round((completedToday.length / tasksToday.length) * 100);

  const todayBlocks = useMemo(() => {
    const sorted = [...tasksToday].sort((a, b) => a.startTime.localeCompare(b.startTime));
    return sorted.slice(0, 6);
  }, [tasksToday]);

  const formatLabel = `${formatWeekday(new Date())} ${formatDateLabel(new Date())}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Vue quotidienne</p>
          <h1 className="font-title text-4xl leading-none text-foreground">Aujourd&apos;hui</h1>
          <p className="mt-1 text-base text-muted-foreground capitalize">{formatLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border/70 bg-muted/50 p-1">
            {[
              { key: "all", label: "Tout" },
              { key: "urgent", label: "Urgentes" },
              { key: "mine", label: "Assignées à moi" },
            ].map((item) => (
              <Button
                key={item.key}
                type="button"
                variant={taskFilter === item.key ? "secondary" : "ghost"}
                size="sm"
                className={cn("h-8 rounded-md px-3 text-xs", taskFilter !== item.key && "text-muted-foreground")}
                onClick={() => setTaskFilter(item.key as TaskFilter)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-9 px-4">
                <Plus className="mr-1.5 h-4 w-4" />
                Nouvelle mission
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nouvelle mission</DialogTitle>
                <DialogDescription>
                  Création complète: date, échéance, note, priorité et assignation.
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
                    date: String(form.get("date") ?? todayIsoDate()),
                    dueDate: String(form.get("dueDate") ?? ""),
                    startTime: String(form.get("start") ?? "09:00"),
                    endTime: String(form.get("end") ?? "10:00"),
                    priority,
                    period,
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
                  <Textarea name="note" placeholder="Contexte, livrable, consignes, liens..." />
                </div>
                <div className="space-y-1">
                  <Label>Date mission</Label>
                  <DatePillPicker name="date" defaultValue={todayIsoDate()} />
                </div>
                <div className="space-y-1">
                  <Label>Échéance</Label>
                  <DatePillPicker name="dueDate" defaultValue={todayIsoDate()} />
                </div>
                <div className="space-y-1">
                  <Label>Début</Label>
                  <Input name="start" type="time" defaultValue="09:00" />
                </div>
                <div className="space-y-1">
                  <Label>Fin</Label>
                  <Input name="end" type="time" defaultValue="10:00" />
                </div>
                <div className="space-y-1">
                  <Label>Période</Label>
                  <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{PERIOD_LABELS.daily}</SelectItem>
                      <SelectItem value="weekly">{PERIOD_LABELS.weekly}</SelectItem>
                      <SelectItem value="monthly">{PERIOD_LABELS.monthly}</SelectItem>
                      <SelectItem value="none">{PERIOD_LABELS.none}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Priorité</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(TASK_PRIORITIES).map((value) => (
                        <SelectItem value={value} key={value}>
                          {TASK_PRIORITY_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" className="w-full">Créer la mission</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {urgentToday.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <CircleAlert className="h-5 w-5" />
              {urgentToday.length} tâche(s) urgente(s) à traiter aujourd&apos;hui
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {urgentToday.slice(0, 3).map((task) => (
              <p key={task._id} className="text-sm text-destructive/90">
                • {task.title}
              </p>
            ))}
            <Button size="sm" variant="secondary" onClick={() => setTaskFilter("urgent")}>
              Voir les urgences
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Progression du jour</CardTitle>
          <CardDescription>
            {completedToday.length}/{tasksToday.length} mission(s) terminée(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={dayProgress} />
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Objectif quotidien</span>
            <span>{dayProgress}%</span>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Priorités du jour</CardTitle>
            <CardDescription>
              {filteredTodayTasks.length} mission(s) active(s) dans la vue sélectionnée.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredTodayTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune mission active avec ce filtre.</p>
            ) : (
              filteredTodayTasks.map((task) => (
                <article key={task._id} className="rounded-lg border border-border/70 bg-background/80 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={task.status === "done"}
                        className="mt-1"
                        onCheckedChange={async (checked) => {
                          await updateTask({
                            taskId: task._id,
                            status: checked ? "done" : "todo",
                          });
                        }}
                      />
                      <div>
                        <p className={cn("font-medium text-foreground", task.status === "done" && "line-through text-muted-foreground")}>
                          {task.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {task.startTime} - {task.endTime}
                          {task.dueDate ? ` • Échéance ${task.dueDate}` : ""}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">{TASK_PRIORITY_LABELS[task.priority]}</Badge>
                  </div>
                  {task.description ? (
                    <p className="mt-2 text-sm text-muted-foreground">{task.description}</p>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between">
                    <Badge variant="outline">{TASK_STATUS_LABELS[task.status]}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        updateTask({
                          taskId: task._id,
                          status: task.status === "done" ? "todo" : "done",
                        })
                      }
                    >
                      <CircleCheckBig className="mr-1.5 h-4 w-4" />
                      {task.status === "done" ? "Rouvrir" : "Marquer terminé"}
                    </Button>
                  </div>
                </article>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tâches terminées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {completedToday.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune mission terminée aujourd&apos;hui.</p>
              ) : (
                completedToday.map((task) => (
                  <div key={task._id} className="rounded-md border border-border/70 p-2.5">
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.startTime} - {task.endTime}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock3 className="h-4 w-4" />
                Blocs horaires du jour
              </CardTitle>
              <CardDescription>
                {completedToday.length}/{todayBlocks.length} bloc(s) finalisé(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {todayBlocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun bloc planifié sur la journée.</p>
              ) : (
                todayBlocks.map((task) => (
                  <div key={task._id} className="flex items-center justify-between rounded-md border border-border/70 p-2.5">
                    <div>
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {task.startTime} - {task.endTime}
                        {task.dueDate ? ` • Échéance ${task.dueDate}` : ""}
                      </p>
                    </div>
                    <Badge variant={task.status === "done" ? "secondary" : "outline"}>
                      {task.status === "done" ? "Terminé" : "Planifié"}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Indicateurs mission</CardTitle>
              <CardDescription>Suivi jour, semaine et mois.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sections.map((section) => (
                <div key={section.period} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-medium">{PERIOD_LABELS[section.period]}</p>
                    <p className="text-muted-foreground">{section.done}/{section.total}</p>
                  </div>
                  <Progress value={section.progress} />
                </div>
              ))}
              <Button asChild variant="outline" className="w-full">
                <Link href="/calendrier">
                  <CalendarPlus2 className="mr-1.5 h-4 w-4" />
                  Ouvrir le calendrier
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
