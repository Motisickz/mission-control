"use client";

import { useMemo } from "react";
import { CalendarDays, CheckCircle2, ListChecks, Sparkles } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { getWeekRange } from "@/lib/datetime";
import { TASK_ENTRY_TYPE_LABELS, TASK_STATUS_LABELS } from "@/lib/domain-constants";
import { getSharedScopeProfileIds, isAssignedToAnyProfile } from "@/lib/shared-profile-scope";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CalendrierAgendaView() {
  const currentProfile = useQuery(api.profiles.getCurrentProfile);
  const profiles = useQuery(api.profiles.listVisibleProfiles);
  const week = getWeekRange(new Date());
  const tasks = useQuery(api.tasks.listCalendarRange, {
    startDate: week.start,
    endDate: week.end,
  });

  const sortedTasks = useMemo(
    () => (tasks ?? []).slice().sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date))),
    [tasks],
  );

  const groupedByDate = useMemo(() => {
    const map = new Map<string, typeof sortedTasks>();
    for (const task of sortedTasks) {
      const list = map.get(task.date) ?? [];
      map.set(task.date, [...list, task]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [sortedTasks]);

  const assignedToMe = useMemo(() => {
    const scopeProfileIds = getSharedScopeProfileIds(currentProfile, profiles);
    if (scopeProfileIds.length === 0) return [];
    return sortedTasks.filter((task) => isAssignedToAnyProfile(task, scopeProfileIds));
  }, [sortedTasks, currentProfile, profiles]);

  const doneCount = sortedTasks.filter((task) => task.status === "done").length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <Card className="overflow-hidden border-border/70 bg-card/90">
          <CardHeader className="relative pb-3">
            <div className="absolute -top-10 right-0 h-32 w-32 rounded-full bg-[color:oklch(0.9_0.07_235/.45)] blur-2xl" />
            <CardTitle className="flex items-center gap-2 text-xl">
              <CalendarDays className="h-5 w-5 text-primary" />
              Agenda hebdomadaire
            </CardTitle>
            <CardDescription>
              Vue dédiée du sous-menu Calendrier: {week.start} → {week.end}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="text-sm font-medium">Vision recommandée</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>1. Capture: crée les tâches/réunions dès qu&apos;elles apparaissent.</li>
                <li>2. Planifie: bloque un créneau horaire précis.</li>
                <li>3. Exécute: traite les priorités du jour en premier.</li>
                <li>4. Revue: fais un check hebdo pour fermer les tâches ouvertes.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle className="text-lg">Indicateurs</CardTitle>
            <CardDescription>Lecture instantanée de la semaine.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><ListChecks className="h-4 w-4" /> Total entrées</p>
              <p className="mt-1 text-2xl font-semibold">{sortedTasks.length}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="h-4 w-4" /> Assignées à moi</p>
              <p className="mt-1 text-2xl font-semibold">{assignedToMe.length}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4" /> Terminées</p>
              <p className="mt-1 text-2xl font-semibold">{doneCount}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Timeline de la semaine</CardTitle>
          <CardDescription>Chaque sous-menu ouvre maintenant une page claire et dédiée.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {groupedByDate.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground">
              Aucune entrée dans l&apos;agenda pour cette semaine.
            </p>
          ) : (
            groupedByDate.map(([date, entries]) => (
              <div key={date} className="rounded-lg border border-border/70 p-3">
                <p className="mb-2 text-sm font-semibold">{date}</p>
                <div className="space-y-2">
                  {entries.map((entry) => {
                    const entryType = entry.entryType ?? "task";
                    return (
                      <article key={entry._id} className="rounded-md border border-border/70 bg-background/70 p-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">{entry.title}</p>
                            <p className="text-sm text-muted-foreground">{entry.startTime} - {entry.endTime}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline">{TASK_ENTRY_TYPE_LABELS[entryType]}</Badge>
                            <Badge variant="secondary">{TASK_STATUS_LABELS[entry.status]}</Badge>
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
    </div>
  );
}
