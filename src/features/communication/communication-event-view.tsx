"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus2, ClipboardList, ExternalLink, RefreshCcw } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import {
  COMMUNICATION_TASK_STATUS_LABELS,
  COMMUNICATION_TASK_STATUSES,
  EDITORIAL_EVENT_CATEGORY_LABELS,
  EDITORIAL_EVENT_PRIORITY_LABELS,
  EDITORIAL_EVENT_STATUS_LABELS,
  EDITORIAL_EVENT_STATUSES,
} from "@/lib/domain-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePillPicker } from "@/components/ui/date-pill-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function compactDate(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function isoTodayInParis() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function CommunicationEventView({ eventId }: { eventId: string }) {
  const data = useQuery(api.communication.getEditorialEventWithTasks, { eventId });
  const profiles = useQuery(api.profiles.listVisibleProfiles);

  const createTask = useMutation(api.communication.createCommunicationTask);
  const updateTask = useMutation(api.communication.updateCommunicationTask);
  const deleteTask = useMutation(api.communication.deleteCommunicationTask);
  const updateEvent = useMutation(api.communication.updateEditorialEvent);

  const [createOpen, setCreateOpen] = useState(false);
  const [taskAssigneeId, setTaskAssigneeId] = useState<string>("");
  const [taskStatus, setTaskStatus] = useState<(typeof COMMUNICATION_TASK_STATUSES)[keyof typeof COMMUNICATION_TASK_STATUSES]>(
    "todo",
  );
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const profileNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const profile of profiles ?? []) {
      map.set(profile._id, profile.displayName);
    }
    return map;
  }, [profiles]);

  const today = useMemo(() => isoTodayInParis(), []);

  const event = data?.event;
  const tasks = data?.tasks ?? [];

  const defaultDueDate = useMemo(() => event?.prepStartDate ?? today, [event, today]);

  const effectiveAssigneeId = useMemo(() => {
    return taskAssigneeId || event?.ownerProfileId || profiles?.[0]?._id || "";
  }, [taskAssigneeId, event, profiles]);

  useEffect(() => {
    setNotesDraft(event?.notes ?? "");
  }, [event?._id, event?.notes]);

  if (data === null) {
    return (
      <div className="space-y-6">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Événement introuvable</CardTitle>
            <CardDescription>
              La fiche n&apos;existe plus, ou tu n&apos;as pas accès à cet événement.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/communication/events">Retour à la liste</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/communication/calendar">Retour au calendrier</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/90">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <ClipboardList className="h-5 w-5 text-primary" />
                {event?.title ?? "Événement"}
              </CardTitle>
              <CardDescription>
                Détails + tâches Communication liées à l&apos;événement.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" asChild>
                <Link href="/communication/events">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Retour liste
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/communication/calendar">Calendrier</Link>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Dates</p>
            <p className="mt-1 text-sm">
              Start: <span className="font-medium">{event ? compactDate(event.startDate) : "-"}</span>
            </p>
            <p className="mt-1 text-sm">
              Prep: <span className="font-medium">{event ? compactDate(event.prepStartDate) : "-"}</span>
            </p>
            {event?.endDate && event.endDate !== event.startDate ? (
              <p className="mt-1 text-sm">
                End: <span className="font-medium">{compactDate(event.endDate)}</span>
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Meta</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {event ? <Badge variant="outline">{EDITORIAL_EVENT_CATEGORY_LABELS[event.category]}</Badge> : null}
              {event ? <Badge variant="outline">{EDITORIAL_EVENT_PRIORITY_LABELS[event.priority]}</Badge> : null}
              {event ? <Badge variant="secondary">{EDITORIAL_EVENT_STATUS_LABELS[event.status]}</Badge> : null}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Owner: {event ? profileNames.get(event.ownerProfileId) ?? "Membre" : "-"}
              {event?.backupOwnerProfileId ? ` • Backup: ${profileNames.get(event.backupOwnerProfileId) ?? "Membre"}` : ""}
            </p>
          </div>

          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Automations</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Auto-créer tâches à la date de préparation:{" "}
              <span className="font-medium text-foreground">
                {event?.autoCreateTemplateTasks ? "Oui" : "Non"}
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Template appliqué:{" "}
              <span className="font-medium text-foreground">
                {event?.templateAppliedAt ? event.templateAppliedAt : "Pas encore"}
              </span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!event}
                onClick={async () => {
                  if (!event) return;
                  try {
                    const result = await updateEvent({ eventId: event._id, applyTemplateNow: true });
                    const created = result.templateResult?.createdCount ?? 0;
                    toast.success(created > 0 ? `${created} tâche(s) créée(s).` : "Template déjà en place.");
                  } catch (error) {
                    const message = error instanceof Error ? error.message : "Impossible d'appliquer le template.";
                    toast.error(message);
                  }
                }}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Appliquer template
              </Button>

              {event ? (
                <Select
                  value={event.status}
                  onValueChange={async (value) => {
                    try {
                      await updateEvent({ eventId: event._id, status: value as never });
                      toast.success("Statut mis à jour.");
                    } catch (error) {
                      const message = error instanceof Error ? error.message : "Impossible de mettre à jour le statut.";
                      toast.error(message);
                    }
                  }}
                >
                  <SelectTrigger className="w-[220px] bg-background/70">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(EDITORIAL_EVENT_STATUSES).map((value) => (
                      <SelectItem key={value} value={value}>
                        {EDITORIAL_EVENT_STATUS_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>Contexte, liens, brief.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Ajoute des notes pour cet événement..."
            className="min-h-28"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!event || savingNotes}
              onClick={async () => {
                if (!event) return;
                setSavingNotes(true);
                try {
                  await updateEvent({ eventId: event._id, notes: notesDraft });
                  toast.success("Notes enregistrées.");
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Impossible d'enregistrer les notes.";
                  toast.error(message);
                } finally {
                  setSavingNotes(false);
                }
              }}
            >
              Enregistrer les notes
            </Button>
            <Button
              variant="secondary"
              disabled={!event || savingNotes}
              onClick={() => setNotesDraft(event?.notes ?? "")}
            >
              Annuler
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Tâches</CardTitle>
            <CardDescription>Template + tâches custom.</CardDescription>
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button disabled={!event}>
                <CalendarPlus2 className="mr-2 h-4 w-4" />
                Ajouter une tâche
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nouvelle tâche</DialogTitle>
                <DialogDescription>Liée à cet événement.</DialogDescription>
              </DialogHeader>

              <form
                className="grid gap-3 md:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!event) return;
                  if (!effectiveAssigneeId) return;
                  const formEl = e.currentTarget;
                  const form = new FormData(formEl);
                  const title = String(form.get("title") ?? "").trim();
                  const dueDate = String(form.get("dueDate") ?? defaultDueDate);
                  const comments = String(form.get("comments") ?? "");

                  try {
                    await createTask({
                      eventId: event._id,
                      title,
                      assigneeProfileId: effectiveAssigneeId as never,
                      dueDate,
                      status: taskStatus,
                      comments: comments.trim() ? comments : undefined,
                      checklist: [],
                    });
                    toast.success("Tâche créée.");
                    formEl.reset();
                    setTaskAssigneeId("");
                    setTaskStatus("todo");
                    setCreateOpen(false);
                  } catch (error) {
                    const message = error instanceof Error ? error.message : "Impossible de créer cette tâche.";
                    toast.error(message);
                  }
                }}
              >
                <div className="space-y-1 md:col-span-2">
                  <Label>Titre</Label>
                  <Input name="title" required placeholder="Ex: Faire valider les visuels" />
                </div>
                <div className="space-y-1">
                  <Label>Assigné(e)</Label>
                  <Select value={effectiveAssigneeId} onValueChange={setTaskAssigneeId} required>
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
                  <Label>Statut</Label>
                  <Select value={taskStatus} onValueChange={(v) => setTaskStatus(v as typeof taskStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(COMMUNICATION_TASK_STATUSES).map((value) => (
                        <SelectItem key={value} value={value}>
                          {COMMUNICATION_TASK_STATUS_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Échéance</Label>
                  <DatePillPicker name="dueDate" defaultValue={defaultDueDate} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Commentaires (optionnel)</Label>
                  <Textarea name="comments" placeholder="Contexte, lien, livrable..." />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" className="w-full">
                    Créer la tâche
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-2">
          {tasks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground">
              Aucune tâche pour le moment.
            </p>
          ) : (
            tasks.map((task) => {
              const overdue = task.dueDate < today && task.status !== "done";
              return (
                <div
                  key={task._id}
                  className={cn(
                    "rounded-lg border border-border/70 bg-background/70 p-3",
                    overdue && "border-[color:oklch(0.85_0.1_28)] bg-[color:oklch(0.97_0.02_28)]",
                  )}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{task.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Échéance: {compactDate(task.dueDate)} • Assigné(e):{" "}
                        {profileNames.get(task.assigneeProfileId) ?? "Membre"}
                      </p>
                      {task.comments ? (
                        <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{task.comments}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={task.status}
                        onValueChange={async (value) => {
                          try {
                            await updateTask({ taskId: task._id, status: value as never });
                            toast.success("Statut mis à jour.");
                          } catch (error) {
                            const message =
                              error instanceof Error ? error.message : "Impossible de mettre à jour cette tâche.";
                            toast.error(message);
                          }
                        }}
                      >
                        <SelectTrigger className="w-[170px] bg-background/70">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(COMMUNICATION_TASK_STATUSES).map((value) => (
                            <SelectItem key={value} value={value}>
                              {COMMUNICATION_TASK_STATUS_LABELS[value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            await deleteTask({ taskId: task._id });
                            toast.success("Tâche supprimée.");
                          } catch (error) {
                            const message =
                              error instanceof Error ? error.message : "Impossible de supprimer cette tâche.";
                            toast.error(message);
                          }
                        }}
                      >
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
