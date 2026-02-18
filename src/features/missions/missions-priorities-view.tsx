"use client";

import { useMemo, useState } from "react";
import { CircleAlert, CircleCheckBig, Target } from "lucide-react";
import { useMutation, useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { formatDateLabel, formatWeekday, todayIsoDate } from "@/lib/datetime";
import { TASK_PRIORITY_LABELS } from "@/lib/domain-constants";
import { getSharedScopeProfileIds, isAssignedToAnyProfile } from "@/lib/shared-profile-scope";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

type TaskFilter = "all" | "urgent" | "mine";

export function MissionsPrioritiesView() {
  const today = todayIsoDate();
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");

  const currentProfile = useQuery(api.profiles.getCurrentProfile);
  const profiles = useQuery(api.profiles.listVisibleProfiles);
  const todayTasks = useQuery(api.tasks.listCalendarRange, { startDate: today, endDate: today });
  const updateTask = useMutation(api.tasks.updateTask);

  const tasks = useMemo(
    () => (todayTasks ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [todayTasks],
  );

  const completed = useMemo(() => tasks.filter((task) => task.status === "done"), [tasks]);
  const urgent = useMemo(
    () => tasks.filter((task) => task.priority === "urgent" && task.status !== "done"),
    [tasks],
  );

  const filtered = useMemo(() => {
    if (taskFilter === "urgent") return tasks.filter((task) => task.priority === "urgent");
    if (taskFilter === "mine") {
      const scopeProfileIds = getSharedScopeProfileIds(currentProfile, profiles);
      if (scopeProfileIds.length === 0) return tasks;
      return tasks.filter((task) => isAssignedToAnyProfile(task, scopeProfileIds));
    }
    return tasks;
  }, [taskFilter, tasks, currentProfile, profiles]);

  const progress = tasks.length === 0 ? 0 : Math.round((completed.length / tasks.length) * 100);
  const todayLabel = `${formatWeekday(new Date())} ${formatDateLabel(new Date())}`;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/70 bg-card/90">
        <CardHeader className="relative">
          <div className="absolute -top-10 right-0 h-32 w-32 rounded-full bg-[color:oklch(0.9_0.07_240/.4)] blur-2xl" />
          <CardTitle className="flex items-center gap-2 text-xl">
            <Target className="h-5 w-5 text-primary" />
            Priorités du jour
          </CardTitle>
          <CardDescription className="capitalize">{todayLabel}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div>
            <Progress value={progress} />
            <p className="mt-2 text-xs text-muted-foreground">
              {completed.length}/{tasks.length} mission(s) terminée(s) aujourd&apos;hui
            </p>
          </div>
        </CardContent>
      </Card>

      {urgent.length > 0 ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <CircleAlert className="h-5 w-5" />
              {urgent.length} tâche(s) urgente(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {urgent.slice(0, 4).map((task) => (
              <p key={task._id} className="text-sm text-destructive/90">• {task.title}</p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Liste opérationnelle</CardTitle>
          <CardDescription>Vue dédiée ouverte depuis le sous-menu Missions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune mission dans cette vue.</p>
          ) : (
            filtered.map((task) => (
              <article key={task._id} className="rounded-lg border border-border/70 bg-background/80 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={task.status === "done"}
                      className="mt-1"
                      onCheckedChange={async (checked) => {
                        await updateTask({ taskId: task._id, status: checked ? "done" : "todo" });
                      }}
                    />
                    <div>
                      <p className={cn("font-medium", task.status === "done" && "line-through text-muted-foreground")}>
                        {task.title}
                      </p>
                      <p className="text-sm text-muted-foreground">{task.startTime} - {task.endTime}</p>
                    </div>
                  </div>
                  <Badge variant="secondary">{TASK_PRIORITY_LABELS[task.priority]}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      updateTask({ taskId: task._id, status: task.status === "done" ? "todo" : "done" })
                    }
                  >
                    <CircleCheckBig className="mr-1.5 h-4 w-4" />
                    {task.status === "done" ? "Rouvrir" : "Terminer"}
                  </Button>
                </div>
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
