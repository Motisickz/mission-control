"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { formatDateLabel, todayIsoDate } from "@/lib/datetime";
import {
  PERIOD_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/domain-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function MissionsView() {
  const daily = useQuery(api.missions.missionOverview, { period: "daily" });
  const weekly = useQuery(api.missions.missionOverview, { period: "weekly" });
  const monthly = useQuery(api.missions.missionOverview, { period: "monthly" });
  const profiles = useQuery(api.profiles.listVisibleProfiles);
  const createTask = useMutation(api.tasks.createTask);
  const [priority, setPriority] = useState<"urgent" | "medium" | "low">("medium");

  const sections = [daily, weekly, monthly].filter(
    (section): section is NonNullable<typeof section> => section !== undefined,
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <Card key={section.period}>
            <CardHeader className="pb-3">
              <CardTitle>{PERIOD_LABELS[section.period]}</CardTitle>
              <CardDescription>
                {section.done}/{section.total} terminees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={section.progress} />
              <p className="mt-2 text-sm text-muted-foreground">Progression: {section.progress}%</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Ajouter une mission</CardTitle>
          <CardDescription>
            Creation rapide avec assignation, priorite et integration calendrier.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const assignee = form.get("assignee") as string;
              if (!assignee) return;
              await createTask({
                title: String(form.get("title") ?? ""),
                description: String(form.get("description") ?? ""),
                assigneeProfileId: assignee as never,
                date: String(form.get("date") ?? todayIsoDate()),
                startTime: String(form.get("start") ?? "09:00"),
                endTime: String(form.get("end") ?? "10:00"),
                priority,
                period: "daily",
                checklist: [],
                calendarFilterIds: [],
              });
              (event.currentTarget as HTMLFormElement).reset();
            }}
          >
            <div className="space-y-1">
              <Label>Titre</Label>
              <Input name="title" required />
            </div>
            <div className="space-y-1">
              <Label>Assignee</Label>
              <Select name="assignee" required>
                <SelectTrigger>
                  <SelectValue placeholder="Selectionner" />
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
            <div className="space-y-1">
              <Label>Date</Label>
              <Input name="date" type="date" defaultValue={todayIsoDate()} />
            </div>
            <div className="space-y-1">
              <Label>Priorite</Label>
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
            <div className="space-y-1">
              <Label>Debut</Label>
              <Input name="start" type="time" defaultValue="09:00" />
            </div>
            <div className="space-y-1">
              <Label>Fin</Label>
              <Input name="end" type="time" defaultValue="10:00" />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" className="w-full">
                Ajouter la mission
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4">
        {(daily?.tasks ?? []).slice(0, 6).map((task) => (
          <Card key={task._id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{task.title}</CardTitle>
                <Badge variant="secondary">{TASK_STATUS_LABELS[task.status]}</Badge>
              </div>
              <CardDescription>
                {formatDateLabel(task.date)} • {task.startTime} - {task.endTime}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  );
}
