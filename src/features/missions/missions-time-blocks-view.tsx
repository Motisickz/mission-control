"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Clock3, Plus, Sparkles } from "lucide-react";
import { useMutation, useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { getWeekRange, toIsoDate, todayIsoDate } from "@/lib/datetime";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/domain-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DatePillPicker } from "@/components/ui/date-pill-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function addDays(base: Date, days: number) {
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

export function MissionsTimeBlocksView() {
  const currentProfile = useQuery(api.profiles.getCurrentProfile);
  const profiles = useQuery(api.profiles.listVisibleProfiles);
  const dailyTemplates = useQuery(api.tasksTemplates.listDailyTemplates);

  const weekRange = useMemo(() => getWeekRange(new Date()), []);
  const weeklyTasks = useQuery(api.tasks.listCalendarRange, {
    startDate: weekRange.start,
    endDate: weekRange.end,
  });

  const createDailyTemplate = useMutation(api.tasksTemplates.createDailyTemplate);
  const createTask = useMutation(api.tasks.createTask);
  const generateInstances = useMutation(api.tasksTemplates.generateInstancesForDateRange);

  const [createOpen, setCreateOpen] = useState(false);
  const [weeklyCustomOpen, setWeeklyCustomOpen] = useState(false);
  const [templatePriority, setTemplatePriority] = useState<"urgent" | "high" | "medium" | "low">("medium");
  const [customPriority, setCustomPriority] = useState<"urgent" | "high" | "medium" | "low">("medium");
  const [createAssigneeId, setCreateAssigneeId] = useState("");
  const [weeklyAssigneeId, setWeeklyAssigneeId] = useState("");
  const [createFormNonce, setCreateFormNonce] = useState(0);
  const [weeklyFormNonce, setWeeklyFormNonce] = useState(0);

  useEffect(() => {
    if (!currentProfile) return;
    const start = toIsoDate(new Date());
    const end = toIsoDate(addDays(new Date(), 56));
    void generateInstances({ startDate: start, endDate: end });
  }, [currentProfile, generateInstances]);

  const templates = useMemo(
    () => (dailyTemplates ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [dailyTemplates],
  );

  const profileNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const profile of profiles ?? []) {
      map.set(profile._id, profile.displayName);
    }
    return map;
  }, [profiles]);

  const fixedBlocksThisWeek = useMemo(
    () =>
      (weeklyTasks ?? [])
        .filter((task) => (task.entryType ?? "task") === "daily_block" && !!task.templateId)
        .sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date))),
    [weeklyTasks],
  );

  const weeklyCustomBlocks = useMemo(
    () =>
      (weeklyTasks ?? [])
        .filter((task) => (task.entryType ?? "task") === "daily_block" && !task.templateId)
        .sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date))),
    [weeklyTasks],
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <Card className="overflow-hidden border-border/70 bg-card/90">
          <CardHeader className="relative pb-3">
            <div className="absolute -top-10 right-0 h-32 w-32 rounded-full bg-[color:oklch(0.9_0.08_290/.4)] blur-2xl" />
            <CardTitle className="flex items-center gap-2 text-xl">
              <CalendarClock className="h-5 w-5 text-primary" />
              Bloc de temps quotidien
            </CardTitle>
            <CardDescription>
              Ces missions sont figées et reviennent tous les jours sur ta journée de travail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog
              open={createOpen}
              onOpenChange={(open) => {
                setCreateOpen(open);
                if (open) {
                  setCreateAssigneeId(currentProfile?._id ?? profiles?.[0]?._id ?? "");
                  setTemplatePriority("medium");
                }
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Nouveau bloc figé quotidien
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Créer un bloc figé quotidien</DialogTitle>
                  <DialogDescription>
                    Ce bloc sera généré automatiquement chaque jour.
                  </DialogDescription>
                </DialogHeader>

                <form
                  key={createFormNonce}
                  className="grid gap-3 md:grid-cols-2"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    const assignee = createAssigneeId || currentProfile?._id || profiles?.[0]?._id || "";
                    if (!assignee) return;

                    await createDailyTemplate({
                      title: String(form.get("title") ?? ""),
                      description: String(form.get("description") ?? ""),
                      startTime: String(form.get("start") ?? "09:00"),
                      endTime: String(form.get("end") ?? "10:00"),
                      priority: templatePriority,
                      assigneeProfileId: assignee as never,
                    });

                    const start = toIsoDate(new Date());
                    const end = toIsoDate(addDays(new Date(), 56));
                    await generateInstances({ startDate: start, endDate: end });

                    event.currentTarget.reset();
                    setTemplatePriority("medium");
                    setCreateAssigneeId(currentProfile?._id ?? profiles?.[0]?._id ?? "");
                    setCreateFormNonce((value) => value + 1);
                    setCreateOpen(false);
                  }}
                >
                  <div className="space-y-1 md:col-span-2">
                    <Label>Titre</Label>
                    <Input name="title" required placeholder="Routine de suivi quotidien" />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <Label>Description</Label>
                    <Input name="description" placeholder="Objectif du bloc figé" />
                  </div>

                  <div className="space-y-1">
                    <Label>Assigné(e)</Label>
                    <Select name="assignee" required value={createAssigneeId} onValueChange={setCreateAssigneeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {(profiles ?? []).map((profile) => (
                          <SelectItem key={profile._id} value={profile._id}>{profile.displayName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>Priorité</Label>
                    <Select value={templatePriority} onValueChange={(value) => setTemplatePriority(value as typeof templatePriority)}>
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
                    <Label>Début</Label>
                    <Input name="start" type="time" defaultValue="09:00" />
                  </div>

                  <div className="space-y-1">
                    <Label>Fin</Label>
                    <Input name="end" type="time" defaultValue="10:00" />
                  </div>

                  <div className="md:col-span-2">
                    <Button type="submit" className="w-full">Enregistrer le bloc figé</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle className="text-lg">Résumé</CardTitle>
            <CardDescription>Vue rapide du système figé + personnalisé.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="h-4 w-4" /> Blocs figés actifs</p>
              <p className="mt-1 text-2xl font-semibold">{templates.length}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="h-4 w-4" /> Semaine en cours</p>
              <p className="mt-1 text-sm font-medium">{weekRange.start} → {weekRange.end}</p>
              <p className="text-xs text-muted-foreground">
                {fixedBlocksThisWeek.length} bloc(s) figé(s) et {weeklyCustomBlocks.length} bloc(s) personnalisé(s)
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Blocs figés (quotidiens)</CardTitle>
          <CardDescription>
            Ces missions reviennent tous les jours, tout au long de la journée.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun bloc figé défini.</p>
          ) : (
            templates.map((item) => (
              <div key={item._id} className="rounded-md border border-border/70 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  <Badge variant="secondary">{TASK_PRIORITY_LABELS[item.priority]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Chaque jour • {item.startTime} - {item.endTime}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Blocs personnalisés de la semaine</CardTitle>
            <CardDescription>
              Ajoute des exceptions ponctuelles pour cette semaine, sans toucher au bloc figé quotidien.
            </CardDescription>
          </div>
          <Dialog
            open={weeklyCustomOpen}
            onOpenChange={(open) => {
              setWeeklyCustomOpen(open);
              if (open) {
                setWeeklyAssigneeId(currentProfile?._id ?? profiles?.[0]?._id ?? "");
                setCustomPriority("medium");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="secondary">
                <Plus className="mr-1.5 h-4 w-4" />
                Ajouter un bloc hebdo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Bloc personnalisé (semaine)</DialogTitle>
                <DialogDescription>
                  Ce bloc s&apos;applique uniquement à une date précise de la semaine.
                </DialogDescription>
              </DialogHeader>

              <form
                key={weeklyFormNonce}
                className="grid gap-3 md:grid-cols-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const assignee = weeklyAssigneeId || currentProfile?._id || profiles?.[0]?._id || "";
                  if (!assignee) return;

                  await createTask({
                    title: String(form.get("title") ?? ""),
                    description: String(form.get("description") ?? ""),
                    assigneeProfileId: assignee as never,
                    date: String(form.get("date") ?? todayIsoDate()),
                    startTime: String(form.get("start") ?? "09:00"),
                    endTime: String(form.get("end") ?? "10:00"),
                    priority: customPriority,
                    period: "none",
                    entryType: "daily_block",
                    checklist: [],
                    calendarFilterIds: [],
                  });

                  event.currentTarget.reset();
                  setCustomPriority("medium");
                  setWeeklyAssigneeId(currentProfile?._id ?? profiles?.[0]?._id ?? "");
                  setWeeklyFormNonce((value) => value + 1);
                  setWeeklyCustomOpen(false);
                }}
              >
                <div className="space-y-1 md:col-span-2">
                  <Label>Titre</Label>
                  <Input name="title" required placeholder="Bloc spécial sprint / lancement" />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <Label>Description</Label>
                  <Input name="description" placeholder="Pourquoi ce bloc est ajouté cette semaine" />
                </div>

                <div className="space-y-1">
                  <Label>Assigné(e)</Label>
                  <Select name="assignee" required value={weeklyAssigneeId} onValueChange={setWeeklyAssigneeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {(profiles ?? []).map((profile) => (
                        <SelectItem key={profile._id} value={profile._id}>{profile.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Priorité</Label>
                  <Select value={customPriority} onValueChange={(value) => setCustomPriority(value as typeof customPriority)}>
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
                  <Label>Date spécifique</Label>
                  <DatePillPicker name="date" defaultValue={todayIsoDate()} />
                </div>

                <div className="space-y-1">
                  <Label>Début</Label>
                  <Input name="start" type="time" defaultValue="09:00" />
                </div>

                <div className="space-y-1">
                  <Label>Fin</Label>
                  <Input name="end" type="time" defaultValue="10:00" />
                </div>

                <div className="md:col-span-2">
                  <Button type="submit" className="w-full">Ajouter le bloc personnalisé</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-2">
          {weeklyCustomBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun bloc personnalisé cette semaine. Le planning figé reste seul actif.
            </p>
          ) : (
            weeklyCustomBlocks.map((task) => (
              <div key={task._id} className="rounded-md border border-border/70 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{task.title}</p>
                  <Badge variant="outline">{TASK_PRIORITY_LABELS[task.priority]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {task.date} • {task.startTime} - {task.endTime}
                </p>
                <p className="text-xs text-muted-foreground">
                  Assigné à: {profileNames.get(task.assigneeProfileId) ?? "Membre"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
