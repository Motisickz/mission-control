"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { IDEA_STATUS_LABELS } from "@/lib/domain-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function IdeesView() {
  const ideas = useQuery(api.ideas.listIdeas);
  const createIdea = useMutation(api.ideas.createIdea);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle idee</CardTitle>
          <CardDescription>Capture rapide des suggestions d&apos;amelioration.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              await createIdea({
                title: String(form.get("title") ?? ""),
                content: String(form.get("content") ?? ""),
              });
              (event.currentTarget as HTMLFormElement).reset();
            }}
          >
            <Input name="title" placeholder="Titre" required />
            <Textarea name="content" placeholder="Description" required />
            <Button type="submit">Ajouter</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backlog idees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(ideas ?? []).map((idea) => (
            <div key={idea._id} className="rounded-md border border-border/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{idea.title}</p>
                <Badge variant="secondary">{IDEA_STATUS_LABELS[idea.status]}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{idea.content}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
