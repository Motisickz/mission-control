"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CalendarClock, ListTodo, Megaphone, Users2 } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import {
  COMMUNICATION_TASK_STATUS_LABELS,
  EDITORIAL_EVENT_CATEGORY_LABELS,
  EDITORIAL_EVENT_PRIORITY_LABELS,
  EDITORIAL_EVENT_STATUS_LABELS,
} from "@/lib/domain-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function compactDate(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function CommunicationDashboardView() {
  const dashboard = useQuery(api.communication.dashboard, {});
  const profiles = useQuery(api.profiles.listVisibleProfiles);

  const profileNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const profile of profiles ?? []) {
      map.set(profile._id, profile.displayName);
    }
    return map;
  }, [profiles]);

  const repartition = useMemo(() => {
    const counts = new Map<string, { owner: number; backup: number }>();
    for (const event of dashboard?.upcomingEvents ?? []) {
      const owner = event.ownerProfileId;
      const backup = event.backupOwnerProfileId;
      const ownerCount = counts.get(owner) ?? { owner: 0, backup: 0 };
      ownerCount.owner += 1;
      counts.set(owner, ownerCount);
      if (backup) {
        const backupCount = counts.get(backup) ?? { owner: 0, backup: 0 };
        backupCount.backup += 1;
        counts.set(backup, backupCount);
      }
    }
    return [...counts.entries()]
      .map(([profileId, value]) => ({
        profileId,
        ...value,
        total: value.owner + value.backup,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [dashboard]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden border-border/70 bg-card/90">
          <CardHeader className="relative pb-3">
            <div className="absolute -top-10 right-0 h-32 w-32 rounded-full bg-[color:oklch(0.92_0.07_300/.45)] blur-2xl" />
            <CardTitle className="flex items-center gap-2 text-xl">
              <Megaphone className="h-5 w-5 text-primary" />
              Communication
            </CardTitle>
            <CardDescription>
              Centralise le calendrier éditorial, les dates de préparation et les tâches associées.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href="/communication/calendar">Calendrier éditorial</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/communication/events">Liste événements</Link>
            </Button>
            <Badge variant="outline">
              Aujourd&apos;hui: {dashboard?.today ?? "..."}
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle className="text-lg">Vue rapide</CardTitle>
            <CardDescription>Les signaux qui comptent en premier.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4" /> À préparer (J+{dashboard?.prepWindowDays ?? 30})
              </p>
              <p className="mt-1 text-2xl font-semibold">{dashboard?.prepSoonEvents.length ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Megaphone className="h-4 w-4" /> Prochains événements (J+{dashboard?.upcomingWindowDays ?? 90})
              </p>
              <p className="mt-1 text-2xl font-semibold">{dashboard?.upcomingEvents.length ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ListTodo className="h-4 w-4" /> Tâches en retard
              </p>
              <p className="mt-1 text-2xl font-semibold">{dashboard?.overdueTasks.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-lg">À préparer bientôt</CardTitle>
            <CardDescription>
              Événements dont la date de préparation est proche.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(dashboard?.prepSoonEvents ?? []).length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground">
                Rien à préparer dans la fenêtre sélectionnée.
              </p>
            ) : (
              (dashboard?.prepSoonEvents ?? []).map((event) => (
                <Link
                  key={event._id}
                  href={`/communication/event/${event._id}`}
                  className="block rounded-lg border border-border/70 bg-background/70 p-3 hover:bg-primary/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{event.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Prep: {compactDate(event.prepStartDate)} • Start: {compactDate(event.startDate)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="secondary">{EDITORIAL_EVENT_STATUS_LABELS[event.status]}</Badge>
                      <Badge variant="outline">{EDITORIAL_EVENT_CATEGORY_LABELS[event.category]}</Badge>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-lg">Prochains événements</CardTitle>
            <CardDescription>Lecture simple de la timeline à venir.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(dashboard?.upcomingEvents ?? []).length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground">
                Aucun événement à venir dans la fenêtre sélectionnée.
              </p>
            ) : (
              (dashboard?.upcomingEvents ?? []).map((event) => (
                <Link
                  key={event._id}
                  href={`/communication/event/${event._id}`}
                  className="block rounded-lg border border-border/70 bg-background/70 p-3 hover:bg-primary/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{event.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {compactDate(event.startDate)} • Owner: {profileNames.get(event.ownerProfileId) ?? "Membre"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="outline">{EDITORIAL_EVENT_PRIORITY_LABELS[event.priority]}</Badge>
                      <Badge variant="secondary">{EDITORIAL_EVENT_STATUS_LABELS[event.status]}</Badge>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-lg">Tâches en retard</CardTitle>
            <CardDescription>À relancer en priorité.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(dashboard?.overdueTasks ?? []).length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground">
                Aucune tâche en retard.
              </p>
            ) : (
              (dashboard?.overdueTasks ?? []).map((task) => (
                <div
                  key={task._id}
                  className={cn(
                    "rounded-lg border border-border/70 bg-background/70 p-3",
                    task.status === "doing" && "bg-[color:oklch(0.97_0.02_230)]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{task.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Événement: {task.eventTitle} • Échéance: {compactDate(task.dueDate)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="secondary">{COMMUNICATION_TASK_STATUS_LABELS[task.status]}</Badge>
                      <Badge variant="outline">{profileNames.get(task.assigneeProfileId) ?? "Membre"}</Badge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users2 className="h-4 w-4" />
            Répartition (owner / backup)
          </CardTitle>
          <CardDescription>Basée sur les prochains événements.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {repartition.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
              Pas assez de données pour calculer la répartition.
            </p>
          ) : (
            repartition.map((row) => (
              <div key={row.profileId} className="rounded-lg border border-border/70 bg-background/70 p-3">
                <p className="font-medium">{profileNames.get(row.profileId) ?? "Membre"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Owner: {row.owner} • Backup: {row.backup}
                </p>
                <p className="mt-2 text-2xl font-semibold">{row.total}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
