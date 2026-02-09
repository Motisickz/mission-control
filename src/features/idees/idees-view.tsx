"use client";

import { useMemo, useState } from "react";
import { Clock3, Lightbulb, Rocket, Sparkles, Target } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import { IDEA_STATUS_LABELS } from "@/lib/domain-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type IdeaStatus = "open" | "in_review" | "adopted" | "archived";

const STATUS_ORDER: IdeaStatus[] = ["open", "in_review", "adopted", "archived"];

const STATUS_CARD_TONE: Record<IdeaStatus, string> = {
  open: "border-[color:oklch(0.88_0.08_232)] bg-[color:oklch(0.97_0.02_232)]",
  in_review: "border-[color:oklch(0.88_0.08_76)] bg-[color:oklch(0.97_0.02_76)]",
  adopted: "border-[color:oklch(0.87_0.08_154)] bg-[color:oklch(0.97_0.02_154)]",
  archived: "border-border/70 bg-muted/30",
};

export function IdeesView() {
  const [activeStatus, setActiveStatus] = useState<"all" | IdeaStatus>("all");
  const ideas = useQuery(api.ideas.listIdeas);
  const profiles = useQuery(api.profiles.listVisibleProfiles);
  const createIdea = useMutation(api.ideas.createIdea);
  const updateIdea = useMutation(api.ideas.updateIdea);

  const profileNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const profile of profiles ?? []) {
      map.set(profile._id, profile.displayName);
    }
    return map;
  }, [profiles]);

  const allIdeas = useMemo(() => ideas ?? [], [ideas]);
  const filteredIdeas = useMemo(() => {
    if (activeStatus === "all") return allIdeas;
    return allIdeas.filter((idea) => idea.status === activeStatus);
  }, [allIdeas, activeStatus]);

  const stats = useMemo(() => {
    const total = allIdeas.length;
    const open = allIdeas.filter((idea) => idea.status === "open").length;
    const inReview = allIdeas.filter((idea) => idea.status === "in_review").length;
    const adopted = allIdeas.filter((idea) => idea.status === "adopted").length;
    return { total, open, inReview, adopted };
  }, [allIdeas]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card className="overflow-hidden border-border/70 bg-card/90">
          <CardHeader className="relative pb-3">
            <div className="absolute -top-10 right-0 h-32 w-32 rounded-full bg-[color:oklch(0.92_0.07_244/.45)] blur-2xl" />
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Studio d&apos;idées
            </CardTitle>
            <CardDescription>
              Structure rapide pour transformer une intuition en piste concrète.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const formEl = event.currentTarget;
                const form = new FormData(formEl);
                const title = String(form.get("title") ?? "").trim();
                const contexte = String(form.get("context") ?? "").trim();
                const objectif = String(form.get("goal") ?? "").trim();
                const impact = String(form.get("impact") ?? "").trim();
                const nextStep = String(form.get("nextStep") ?? "").trim();

                const content = [
                  contexte && `Contexte: ${contexte}`,
                  objectif && `Objectif: ${objectif}`,
                  impact && `Impact attendu: ${impact}`,
                  nextStep && `Première action: ${nextStep}`,
                ]
                  .filter(Boolean)
                  .join("\n");

                await createIdea({
                  title,
                  content,
                });

                toast.success("Idée enregistrée.");
                formEl.reset();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="title">Titre de l&apos;idée</Label>
                <Input id="title" name="title" placeholder="Ex: Fluidifier le suivi hebdomadaire" required />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="context">Contexte</Label>
                  <Textarea id="context" name="context" placeholder="Situation actuelle" className="min-h-24" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal">Objectif</Label>
                  <Textarea id="goal" name="goal" placeholder="Résultat visé" className="min-h-24" />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="impact">Impact attendu</Label>
                  <Textarea id="impact" name="impact" placeholder="Valeur business/équipe" className="min-h-24" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nextStep">Première action</Label>
                  <Textarea id="nextStep" name="nextStep" placeholder="Action la plus simple à lancer" className="min-h-24" />
                </div>
              </div>

              <Button type="submit" className="w-full md:w-auto">Ajouter l&apos;idée</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle className="text-lg">Vue d&apos;ensemble</CardTitle>
            <CardDescription>Lecture instantanée du pipeline d&apos;innovation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Lightbulb className="h-4 w-4" /> Idées capturées</p>
              <p className="mt-1 text-2xl font-semibold">{stats.total}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="h-4 w-4" /> En attente</p>
              <p className="mt-1 text-2xl font-semibold">{stats.open}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Target className="h-4 w-4" /> En revue</p>
              <p className="mt-1 text-2xl font-semibold">{stats.inReview}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Rocket className="h-4 w-4" /> Adoptées</p>
              <p className="mt-1 text-2xl font-semibold">{stats.adopted}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Backlog idées</CardTitle>
          <CardDescription>Trie, qualifie et fais progresser chaque idée sans quitter la page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeStatus} onValueChange={(value) => setActiveStatus(value as typeof activeStatus)}>
            <TabsList>
              <TabsTrigger value="all">Toutes</TabsTrigger>
              <TabsTrigger value="open">Ouvertes</TabsTrigger>
              <TabsTrigger value="in_review">En revue</TabsTrigger>
              <TabsTrigger value="adopted">Adoptées</TabsTrigger>
              <TabsTrigger value="archived">Archivées</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-3">
            {filteredIdeas.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground">
                Aucune idée dans cette vue pour le moment.
              </p>
            ) : (
              filteredIdeas.map((idea) => (
                <div key={idea._id} className={cn("rounded-lg border p-4", STATUS_CARD_TONE[idea.status])}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{idea.title}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-line">{idea.content}</p>
                      <p className="text-xs text-muted-foreground">
                        Auteur: {profileNames.get(idea.authorProfileId) ?? "Membre"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{IDEA_STATUS_LABELS[idea.status]}</Badge>
                      <Select
                        value={idea.status}
                        onValueChange={async (value) => {
                          await updateIdea({ ideaId: idea._id, status: value as IdeaStatus });
                          toast.success("Statut mis à jour.");
                        }}
                      >
                        <SelectTrigger className="w-40 bg-background/70">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_ORDER.map((status) => (
                            <SelectItem key={status} value={status}>
                              {IDEA_STATUS_LABELS[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
