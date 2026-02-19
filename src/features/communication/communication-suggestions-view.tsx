"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Sparkles } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import {
  EDITORIAL_EVENT_CATEGORIES,
  EDITORIAL_EVENT_CATEGORY_LABELS,
  EDITORIAL_EVENT_PRIORITIES,
  EDITORIAL_EVENT_PRIORITY_LABELS,
  EDITORIAL_EVENT_STATUSES,
  EDITORIAL_EVENT_STATUS_LABELS,
} from "@/lib/domain-constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type SortMode = "prep_then_post" | "post_then_prep";
type WindowMode = "all" | "prep_30" | "post_90";

type IsoDate = `${number}-${string}-${string}`;

type SuggestionJson = {
  strategie: {
    objectif: string;
    angle: string;
    planning: string[];
    cta: string;
    kpis: string[];
  };
  reels: Array<{
    titre: string;
    hook: string;
    scenario: string;
    plans: string[];
    texteOnScreen: string;
    caption: string;
    cta: string;
    hashtags: string[];
  }>;
  stories: Array<{
    titre: string;
    sequence: string[];
    cta: string;
  }>;
  themes: Array<{
    theme: string;
    pourquoi: string;
    variantes: string[];
  }>;
  checklist: string[];
};

type EventLike = {
  _id: string;
  title: string;
  category: "marronnier" | "soldes" | "interne";
  status: "a_preparer" | "en_creation" | "programme" | "publie" | "rex";
  priority: "faible" | "moyen" | "eleve";
  startDate: string;
  prepStartDate: string;
  ownerProfileId: string;
  backupOwnerProfileId?: string;
  notes?: string;
};

function isoTodayInParis(): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()) as IsoDate;
}

function fromIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function toIsoDate(date: Date): IsoDate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as IsoDate;
}

function addIsoDays(isoDate: IsoDate, days: number): IsoDate {
  const d = fromIsoDate(isoDate);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

function compactDate(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

type LocalContext = {
  occasionLabel: string;
  emotionalHook: string;
  offerLine: string;
  storyIdea: string;
  reelIdea: string;
  themeIdea: string;
};

function contextFromTitle(title: string): LocalContext {
  const t = title.toLowerCase();

  if (
    t.includes("grand mère") ||
    t.includes("grand-mère") ||
    t.includes("grands mères") ||
    t.includes("grands-mères")
  ) {
    return {
      occasionLabel: "Fête des grands-mères",
      emotionalHook: "Offrir une chanson personnalisée à sa grand-mère",
      offerLine: "Pack message vocal + instru douce + mix final prêt à envoyer",
      storyIdea: "Story: « Et si tu déclarais ton amour à ta grand-mère en chanson ? »",
      reelIdea: "Reel: transformation d'un message vocal pour mamie en morceau émotion",
      themeIdea: "Souvenir familial en musique",
    };
  }

  if (t.includes("saint valentin") || t.includes("saint-valentin")) {
    return {
      occasionLabel: "Saint-Valentin",
      emotionalHook: "Créer une déclaration audio romantique unique",
      offerLine: "Pack duo voix + piano + mix romantique",
      storyIdea: "Story: « 15 secondes pour dire je t'aime autrement »",
      reelIdea: "Reel avant/après d'une dédicace amoureuse enregistrée en studio",
      themeIdea: "Déclaration romantique audio",
    };
  }

  if (t.includes("noel") || t.includes("noël")) {
    return {
      occasionLabel: "Noël",
      emotionalHook: "Offrir un cadeau audio personnalisé à la famille",
      offerLine: "Pack carte audio de Noël + habillage sonore festif",
      storyIdea: "Story: « Cette année, offre une voix, pas un objet »",
      reelIdea: "Reel coulisses d'un message vocal de Noël transformé en capsule pro",
      themeIdea: "Cadeau audio personnalisé",
    };
  }

  if (t.includes("fete des meres") || t.includes("fête des mères") || t.includes("fete des mères")) {
    return {
      occasionLabel: "Fête des mères",
      emotionalHook: "Transformer un message de gratitude en souvenir audio",
      offerLine: "Pack message pour maman + instrumental + mastering",
      storyIdea: "Story: « Le plus beau cadeau pour maman: ta voix »",
      reelIdea: "Reel: voix brute -> version studio pour la fête des mères",
      themeIdea: "Hommage à maman en musique",
    };
  }

  if (t.includes("fete des peres") || t.includes("fête des pères") || t.includes("fete des pères")) {
    return {
      occasionLabel: "Fête des pères",
      emotionalHook: "Créer un message audio fort et personnel pour son père",
      offerLine: "Pack voix + ambiance + mix premium",
      storyIdea: "Story: « Un message pour ton père qu'il gardera toute sa vie »",
      reelIdea: "Reel: enregistrement express d'une dédicace père/enfant",
      themeIdea: "Transmission et émotion",
    };
  }

  return {
    occasionLabel: title,
    emotionalHook: "Créer un contenu audio marquant autour de l'événement",
    offerLine: "Pack studio voix + mix + rendu pro prêt à partager",
    storyIdea: "Story: « Et si ton message devenait un vrai souvenir audio ? »",
    reelIdea: "Reel: coulisses + avant/après sur une création audio du studio",
    themeIdea: "Contenu émotionnel et preuve de qualité sonore",
  };
}

function localSuggestion(event: EventLike): SuggestionJson {
  const eventLabel = event.title;
  const ctx = contextFromTitle(event.title);
  const daysBeforePost = Math.max(
    1,
    Math.round((fromIsoDate(event.startDate).getTime() - fromIsoDate(event.prepStartDate).getTime()) / (1000 * 3600 * 24)),
  );
  const angle =
    event.category === "soldes"
      ? "Offre claire + urgence + preuve sociale"
      : event.category === "interne"
        ? "Coulisses + expertise + proximité"
        : "Émotion + ancrage saisonnier";

  return {
    strategie: {
      objectif: "Générer des demandes de réservation qualifiées pour le studio",
      angle,
      planning: [
        `Semaine 1 (J-${daysBeforePost} à J-${Math.max(1, daysBeforePost - 7)}): teaser ${ctx.occasionLabel} + promesse émotionnelle`,
        "Semaine 2: formats pédagogiques courts (erreurs à éviter, conseils mix/master)",
        `Semaine 3: montée en preuve sociale autour de \"${ctx.occasionLabel}\"`,
        "Semaine 4: call-to-action direct (slots restants + prise de contact)",
      ],
      cta: "DM \"SESSION\" pour recevoir un créneau + devis",
      kpis: [
        "Taux de réponse aux stories",
        "Nombre de DM entrants qualifiés",
        "Clics vers prise de rendez-vous",
        "Taux de conversion DM -> appel",
      ],
    },
    reels: [
      {
        titre: `Avant/Après audio - ${eventLabel}`,
        hook: `${ctx.emotionalHook} en qualité studio`,
        scenario:
          `${ctx.reelIdea}. Montre un extrait brut, puis le résultat final. Explique en voix off les 2 réglages qui changent tout.`,
        plans: ["Waveform écran", "Studio plan large", "Ingé son sur console", "Réaction artiste"],
        texteOnScreen: "Avant / Après - Mix Pro",
        caption:
          `On transforme ton idée ${ctx.occasionLabel} en souvenir audio pro. ${ctx.offerLine}.`,
        cta: "DM SESSION",
        hashtags: ["#studiorecording", "#mixing", "#mastering", "#ingenieurduson"],
      },
      {
        titre: "3 erreurs qui ruinent une prise voix",
        hook: "90% des artistes font cette erreur...",
        scenario: "Format éducatif: 3 erreurs, 3 corrections simples, exemple audio à la clé.",
        plans: ["Face cam", "Mic close-up", "DAW screen", "Plan ambiance cabine"],
        texteOnScreen: "Stop à ces erreurs",
        caption: "Tu veux une checklist avant ta session ?",
        cta: "Commente CHECKLIST",
        hashtags: ["#voix", "#enregistrement", "#musique", "#studio"],
      },
      {
        titre: "Une session client en 30 secondes",
        hook: "Comment se passe une vraie session chez nous ?",
        scenario: "Timeline rapide: accueil, setup, enregistrement, retouches, rendu final.",
        plans: ["Accueil", "Setup micro", "Session live", "Export final"],
        texteOnScreen: "Session réelle en 30s",
        caption: "Transparence totale sur notre process studio.",
        cta: "Réserve ton créneau",
        hashtags: ["#behindthescenes", "#studiolife", "#artist"],
      },
    ],
    stories: [
      {
        titre: "Sondage besoin client (occasion)",
        sequence: [
          `Slide 1: ${ctx.storyIdea}`,
          "Slide 2: Ton plus gros blocage (prise voix / mix / budget)",
          "Slide 3: Mini conseil personnalisé",
        ],
        cta: "Réponds au sondage",
      },
      {
        titre: "Backstage session",
        sequence: [
          "Slide 1: Setup cabine",
          "Slide 2: Extrait brut",
          "Slide 3: Extrait traité",
          "Slide 4: Retour artiste",
        ],
        cta: "DM pour devis",
      },
      {
        titre: "Offre / créneaux restants",
        sequence: [
          `Slide 1: Focus ${ctx.occasionLabel}`,
          `Slide 2: ${ctx.offerLine}`,
          "Slide 3: 2 créneaux restants cette semaine",
        ],
        cta: "Réserver maintenant",
      },
    ],
    themes: [
      {
        theme: "Avant / Après",
        pourquoi: "Le format preuve de résultat convertit très bien en studio.",
        variantes: ["Voix rap", "Podcast", "Chant pop", ctx.themeIdea],
      },
      {
        theme: "Conseil expert",
        pourquoi: "Positionne le studio comme référence et crée la confiance.",
        variantes: ["Placement micro", "Traitement acoustique", "Préparation artiste", ctx.emotionalHook],
      },
      {
        theme: "Coulisses humaines",
        pourquoi: "Humanise la marque et donne envie de vivre l'expérience.",
        variantes: ["Vie d'équipe", "Routine session", "Matériel du jour", ctx.occasionLabel],
      },
    ],
    checklist: [
      "Pré-prod: définir angle + hooks + planning 2 semaines",
      "Prod: tourner 2 reels + 1 story backstage par semaine",
      "Post-prod: sous-titrer, publier aux heures fortes, répondre aux DM sous 2h",
    ],
  };
}

export function CommunicationSuggestionsView() {
  const events = useQuery(api.communication.listEditorialEvents);
  const profiles = useQuery(api.profiles.listVisibleProfiles);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<
    "all" | (typeof EDITORIAL_EVENT_CATEGORIES)[keyof typeof EDITORIAL_EVENT_CATEGORIES]
  >("all");
  const [status, setStatus] = useState<
    "all" | (typeof EDITORIAL_EVENT_STATUSES)[keyof typeof EDITORIAL_EVENT_STATUSES]
  >("all");
  const [priority, setPriority] = useState<
    "all" | (typeof EDITORIAL_EVENT_PRIORITIES)[keyof typeof EDITORIAL_EVENT_PRIORITIES]
  >("all");
  const [ownerProfileId, setOwnerProfileId] = useState<string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("prep_then_post");
  const [windowMode, setWindowMode] = useState<WindowMode>("all");

  const profileNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const profile of profiles ?? []) {
      map.set(profile._id, profile.displayName);
    }
    return map;
  }, [profiles]);

  const today = useMemo(() => isoTodayInParis(), []);
  const prepCutoff = useMemo(() => addIsoDays(today, 30), [today]);
  const postCutoff = useMemo(() => addIsoDays(today, 90), [today]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = events ?? [];

    const narrowed = source.filter((event) => {
      if (category !== "all" && event.category !== category) return false;
      if (status !== "all" && event.status !== status) return false;
      if (priority !== "all" && event.priority !== priority) return false;
      if (ownerProfileId !== "all") {
        if (event.ownerProfileId !== ownerProfileId && event.backupOwnerProfileId !== ownerProfileId) return false;
      }
      if (q && !event.title.toLowerCase().includes(q)) return false;

      if (windowMode === "prep_30") {
        return event.prepStartDate >= today && event.prepStartDate <= prepCutoff;
      }
      if (windowMode === "post_90") {
        return event.startDate >= today && event.startDate <= postCutoff;
      }
      return true;
    });

    return narrowed.slice().sort((a, b) => {
      if (sortMode === "post_then_prep") {
        if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
        if (a.prepStartDate !== b.prepStartDate) return a.prepStartDate.localeCompare(b.prepStartDate);
      } else {
        if (a.prepStartDate !== b.prepStartDate) return a.prepStartDate.localeCompare(b.prepStartDate);
        if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
      }
      return a.title.localeCompare(b.title);
    });
  }, [events, category, status, priority, ownerProfileId, query, sortMode, windowMode, today, prepCutoff, postCutoff]);

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return filtered.find((event) => event._id === selectedEventId) ?? null;
  }, [filtered, selectedEventId]);

  const recommendation = useMemo(() => {
    if (!selectedEvent) return null;
    return localSuggestion(selectedEvent as EventLike);
  }, [selectedEvent]);

  const recommendationsByEventId = useMemo(() => {
    const map = new Map<string, SuggestionJson>();
    for (const event of filtered) {
      map.set(event._id, localSuggestion(event as EventLike));
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/90">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Suggestion IA
          </CardTitle>
          <CardDescription>
            Recommandation automatique locale (sans API payante) pour ton studio d&apos;enregistrement.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Événements</CardTitle>
          <CardDescription>{filtered.length} résultat(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Recherche</Label>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tape un mot du titre..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Fenêtre</Label>
              <Select value={windowMode} onValueChange={(v) => setWindowMode(v as WindowMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="prep_30">À préparer (30j)</SelectItem>
                  <SelectItem value="post_90">À poster (90j)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Tri</Label>
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prep_then_post">Échéance (prep) puis post</SelectItem>
                  <SelectItem value="post_then_prep">Post puis échéance (prep)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Owner</Label>
              <Select value={ownerProfileId} onValueChange={setOwnerProfileId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tout le monde</SelectItem>
                  {(profiles ?? []).map((profile) => (
                    <SelectItem key={profile._id} value={profile._id}>
                      {profile.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Catégorie</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {Object.values(EDITORIAL_EVENT_CATEGORIES)
                    .filter((value) => value !== "marronnier")
                    .map((value) => (
                      <SelectItem key={value} value={value}>
                        {EDITORIAL_EVENT_CATEGORY_LABELS[value]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {Object.values(EDITORIAL_EVENT_STATUSES).map((value) => (
                    <SelectItem key={value} value={value}>
                      {EDITORIAL_EVENT_STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Priorité</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {Object.values(EDITORIAL_EVENT_PRIORITIES).map((value) => (
                    <SelectItem key={value} value={value}>
                      {EDITORIAL_EVENT_PRIORITY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        {filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground">
            Aucun événement dans cette vue.
          </p>
        ) : (
          filtered.map((event) => {
            const active = selectedEventId === event._id;
            const suggestion = recommendationsByEventId.get(event._id);
            if (!suggestion) return null;
            return (
              <Card key={event._id} className={cn("border-border/70", active && "border-primary/50 bg-primary/5")}>
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="truncate text-lg">{event.title}</CardTitle>
                      <CardDescription>
                        Prep: {compactDate(event.prepStartDate)} • Post: {compactDate(event.startDate)} • Owner:{" "}
                        {profileNames.get(event.ownerProfileId) ?? "Membre"}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{EDITORIAL_EVENT_CATEGORY_LABELS[event.category]}</Badge>
                      <Badge variant="outline">{EDITORIAL_EVENT_PRIORITY_LABELS[event.priority]}</Badge>
                      <Badge variant="secondary">{EDITORIAL_EVENT_STATUS_LABELS[event.status]}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Objectif</p>
                      <p className="mt-1 text-sm font-medium">{suggestion.strategie.objectif}</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Angle RS</p>
                      <p className="mt-1 text-sm font-medium">{suggestion.strategie.angle}</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">CTA principal</p>
                      <p className="mt-1 text-sm font-medium">{suggestion.strategie.cta}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Idées Reels</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {suggestion.reels.slice(0, 3).map((item, idx) => (
                          <li key={idx}>{item.titre}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Idées Stories</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {suggestion.stories.slice(0, 3).map((item, idx) => (
                          <li key={idx}>{item.titre}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedEventId(event._id)}
                    className={cn(
                      "w-full rounded-md border border-border/70 bg-background px-3 py-2 text-left text-sm font-medium hover:bg-primary/5",
                      active && "border-primary/40 bg-primary/10",
                    )}
                  >
                    {active ? "Dossier affiché plus bas" : "Ouvrir le dossier complet (vue détaillée)"}
                  </button>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      {selectedEvent && recommendation ? (
        <Card id="suggestion-dossier" className="border-primary/40 bg-primary/[0.04]">
          <CardHeader className="space-y-3">
            <CardTitle className="text-xl">Dossier RS complet - {selectedEvent.title}</CardTitle>
            <CardDescription>
              Plan détaillé prêt à produire: stratégie, calendrier, scripts Reels/Stories, thèmes éditoriaux, KPI et
              checklist exécution.
            </CardDescription>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{EDITORIAL_EVENT_CATEGORY_LABELS[selectedEvent.category]}</Badge>
              <Badge variant="outline">{EDITORIAL_EVENT_PRIORITY_LABELS[selectedEvent.priority]}</Badge>
              <Badge variant="secondary">{EDITORIAL_EVENT_STATUS_LABELS[selectedEvent.status]}</Badge>
              <Badge variant="outline">Prep: {compactDate(selectedEvent.prepStartDate)}</Badge>
              <Badge variant="outline">Post: {compactDate(selectedEvent.startDate)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Objectif</p>
                <p className="mt-1 text-sm font-medium">{recommendation.strategie.objectif}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Angle éditorial</p>
                <p className="mt-1 text-sm font-medium">{recommendation.strategie.angle}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">CTA stratégique</p>
                <p className="mt-1 text-sm font-medium">{recommendation.strategie.cta}</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">Planning de campagne</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {recommendation.strategie.planning.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">KPI de suivi</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {recommendation.strategie.kpis.map((kpi, i) => (
                      <li key={i}>{kpi}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="text-base">Scripts Reels (détaillés)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recommendation.reels.map((r, i) => (
                  <div key={i} className="rounded-lg border border-border/70 bg-background/70 p-3 text-sm">
                    <p className="font-medium">{r.titre}</p>
                    <p className="mt-1 text-muted-foreground">
                      Hook: <span className="text-foreground">{r.hook}</span>
                    </p>
                    <p className="mt-2 whitespace-pre-line text-muted-foreground">{r.scenario}</p>
                    <p className="mt-2">
                      <span className="text-muted-foreground">Texte écran:</span> {r.texteOnScreen}
                    </p>
                    <p className="mt-1">
                      <span className="text-muted-foreground">Caption:</span> {r.caption}
                    </p>
                    <p className="mt-1">
                      <span className="text-muted-foreground">CTA:</span> {r.cta}
                    </p>
                    <p className="mt-2 text-muted-foreground">Plans:</p>
                    <ul className="list-disc pl-5">
                      {r.plans.map((plan, j) => (
                        <li key={j}>{plan}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-muted-foreground">Hashtags:</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.hashtags.map((tag, j) => (
                        <Badge key={j} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="text-base">Flow Stories (détaillé)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recommendation.stories.map((s, i) => (
                  <div key={i} className="rounded-lg border border-border/70 bg-background/70 p-3 text-sm">
                    <p className="font-medium">{s.titre}</p>
                    <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                      {s.sequence.map((x, j) => (
                        <li key={j}>{x}</li>
                      ))}
                    </ul>
                    <p className="mt-2">
                      <span className="text-muted-foreground">CTA final:</span> {s.cta}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">Thèmes éditoriaux</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {recommendation.themes.map((t, i) => (
                    <div key={i} className="rounded-lg border border-border/70 bg-background/70 p-3">
                      <p className="font-medium">{t.theme}</p>
                      <p className="mt-1 text-muted-foreground">{t.pourquoi}</p>
                      <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                        {t.variantes.map((variant, j) => (
                          <li key={j}>{variant}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">Checklist d&apos;exécution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {recommendation.checklist.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
