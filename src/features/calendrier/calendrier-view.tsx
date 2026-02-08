"use client";

import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { getMonthRange } from "@/lib/datetime";
import { TASK_PRIORITY_LABELS } from "@/lib/domain-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function CalendrierView() {
  const range = useMemo(() => getMonthRange(), []);
  const tasks = useQuery(api.tasks.listCalendarRange, {
    startDate: range.start,
    endDate: range.end,
  });
  const filters = useQuery(api.calendar.list);
  const createFilter = useMutation(api.calendar.createFilter);

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
              const form = new FormData(event.currentTarget);
              await createFilter({
                name: String(form.get("name") ?? ""),
                color: String(form.get("color") ?? "oklch(0.65 0.18 250)"),
                criteria: String(form.get("criteria") ?? ""),
              });
              (event.currentTarget as HTMLFormElement).reset();
            }}
          >
            <Input name="name" placeholder="Nom du filtre" required />
            <Input name="criteria" placeholder="Critere" />
            <Input name="color" defaultValue="oklch(0.66 0.18 247)" />
            <Button type="submit">Ajouter un filtre</Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {(filters ?? []).map((filter) => (
              <Badge key={filter._id} variant="outline" style={{ borderColor: filter.color }}>
                {filter.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planning mensuel</CardTitle>
          <CardDescription>
            Du {range.start} au {range.end}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(tasks ?? []).map((task) => (
            <div key={task._id} className="rounded-md border border-border/70 p-3">
              <p className="font-medium">{task.title}</p>
              <p className="text-sm text-muted-foreground">
                {task.date} • {task.startTime}-{task.endTime}
              </p>
              <Badge className="mt-2" variant="secondary">
                {TASK_PRIORITY_LABELS[task.priority]}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
