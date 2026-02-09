import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Lightbulb,
  Rocket,
  Sparkles,
  Target,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const missions = [
  { title: "Préparer reporting hebdomadaire", time: "09:30 - 10:15", priority: "Urgente", status: "En cours" },
  { title: "Relire les livrables client", time: "11:00 - 11:45", priority: "Moyenne", status: "À faire" },
  { title: "Synchroniser l'équipe", time: "14:00 - 14:30", priority: "Moyenne", status: "Fait" },
];

const ideas = [
  {
    title: "Routine de priorisation du matin",
    status: "En revue",
    content: "Lancer un rituel quotidien de 15 minutes pour clarifier les urgences.",
  },
  {
    title: "Template onboarding stagiaire",
    status: "Ouverte",
    content: "Standardiser les 10 premiers jours pour accélérer l'autonomie.",
  },
  {
    title: "Résumé hebdo auto",
    status: "Adoptée",
    content: "Envoyer automatiquement un bilan visuel des tâches clés le vendredi.",
  },
];

const notifications = [
  { title: "Nouvelle tâche assignée: relire brief", kind: "Assignation", read: false },
  { title: "Statut mis à jour: planning validé", kind: "Mise à jour", read: false },
  { title: "Rappel: échéance proche sur reporting", kind: "Alerte", read: true },
];

export default function ApercuPublicPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(70rem_40rem_at_10%_10%,oklch(0.96_0.04_255),transparent),radial-gradient(50rem_30rem_at_90%_20%,oklch(0.96_0.03_40),transparent),linear-gradient(130deg,oklch(0.99_0.01_250),oklch(0.97_0.01_80))] px-4 py-10 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-border/70 bg-background/80 p-6 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Aperçu public</p>
              <h1 className="font-title text-4xl leading-none">Mission contrôle</h1>
              <p className="text-muted-foreground">
                Démo sans connexion pour partager la direction produit et le design.
              </p>
            </div>
            <Badge variant="secondary" className="h-7 px-3">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Version de présentation
            </Badge>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/70 bg-card/90">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock3 className="h-4 w-4 text-primary" />
                Missions du jour
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">12</p>
              <p className="text-sm text-muted-foreground">8 complétées, 4 en cours</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/90">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="h-4 w-4 text-primary" />
                Idées en pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">7</p>
              <p className="text-sm text-muted-foreground">3 en revue, 2 adoptées</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/90">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BellRing className="h-4 w-4 text-primary" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">5</p>
              <p className="text-sm text-muted-foreground">2 à traiter maintenant</p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Extrait - Vue missions
              </CardTitle>
              <CardDescription>Structure actuelle de l&apos;interface missions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {missions.map((mission) => (
                <article key={mission.title} className="rounded-xl border border-border/70 bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{mission.title}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{mission.priority}</Badge>
                      <Badge variant="secondary">{mission.status}</Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{mission.time}</p>
                </article>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                Extrait - Vue idées
              </CardTitle>
              <CardDescription>Organisation du backlog et des statuts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ideas.map((idea) => (
                <article key={idea.title} className="rounded-xl border border-border/70 bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{idea.title}</p>
                    <Badge variant="secondary">{idea.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{idea.content}</p>
                </article>
              ))}
            </CardContent>
          </Card>
        </section>

        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-primary" />
              Extrait - Vue notifications
            </CardTitle>
            <CardDescription>Lecture rapide des notifications prioritaires.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.map((notification) => (
              <article key={notification.title} className="rounded-xl border border-border/70 bg-background/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{notification.title}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{notification.kind}</Badge>
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      {notification.read ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Lue
                        </>
                      ) : (
                        <>
                          <CircleAlert className="h-4 w-4 text-amber-600" /> À traiter
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>

        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/80 p-4">
          <p className="text-sm text-muted-foreground">
            Cette page est publique et ne nécessite aucun compte.
          </p>
          <Button asChild>
            <Link href="/connexion">
              Accéder à l&apos;application interne
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </footer>
      </div>
    </div>
  );
}
