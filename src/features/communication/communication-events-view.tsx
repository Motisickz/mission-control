"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarPlus2, Filter, ListChecks } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import {
  EDITORIAL_EVENT_CATEGORIES,
  EDITORIAL_EVENT_CATEGORY_LABELS,
  EDITORIAL_EVENT_PRIORITY_LABELS,
  EDITORIAL_EVENT_PRIORITIES,
  EDITORIAL_EVENT_STATUSES,
  EDITORIAL_EVENT_STATUS_LABELS,
} from "@/lib/domain-constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EditorialEventCreateDialog } from "@/features/communication/editorial-event-create-dialog";

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function compactDate(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function CommunicationEventsView() {
  const events = useQuery(api.communication.listEditorialEvents);
  const profiles = useQuery(api.profiles.listVisibleProfiles);
  const currentProfile = useQuery(api.profiles.getCurrentProfile);

  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | (typeof EDITORIAL_EVENT_CATEGORIES)[keyof typeof EDITORIAL_EVENT_CATEGORIES]>("all");
  const [status, setStatus] = useState<"all" | (typeof EDITORIAL_EVENT_STATUSES)[keyof typeof EDITORIAL_EVENT_STATUSES]>("all");
  const [priority, setPriority] = useState<"all" | (typeof EDITORIAL_EVENT_PRIORITIES)[keyof typeof EDITORIAL_EVENT_PRIORITIES]>("all");
  const [ownerProfileId, setOwnerProfileId] = useState<string>("all");
  const [sortMode, setSortMode] = useState<"prep_then_post" | "post_then_prep">("prep_then_post");
  const [windowMode, setWindowMode] = useState<"all" | "prep_30" | "post_90">("all");

  const profileNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const profile of profiles ?? []) {
      map.set(profile._id, profile.displayName);
    }
    return map;
  }, [profiles]);

  const today = useMemo(() => {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }, []);

  const prepCutoff = useMemo(() => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + 30);
    return toIsoDate(d);
  }, [today]);

  const postCutoff = useMemo(() => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + 90);
    return toIsoDate(d);
  }, [today]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const narrowed = (events ?? []).filter((event) => {
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

  const defaultDate = useMemo(() => toIsoDate(new Date()), []);

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/90">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <ListChecks className="h-5 w-5 text-primary" />
                Événements Communication
              </CardTitle>
              <CardDescription>
                Vue table filtrable (catégorie, owner, statut, priorité).
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setCreateOpen(true)}>
                <CalendarPlus2 className="mr-2 h-4 w-4" />
                Ajouter
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/communication/calendar">Calendrier</Link>
              </Button>
              <Badge variant="outline">{filtered.length} événement(s)</Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-3 lg:grid-cols-[1.2fr_repeat(6,minmax(0,1fr))]">
          <div className="space-y-1 lg:col-span-1">
            <Label className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Recherche
            </Label>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tape un mot du titre..." />
          </div>

          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Fenêtre</Label>
            <Select value={windowMode} onValueChange={(v) => setWindowMode(v as typeof windowMode)}>
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
            <Select value={sortMode} onValueChange={(v) => setSortMode(v as typeof sortMode)}>
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
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Liste</CardTitle>
          <CardDescription>Clique un titre pour ouvrir la fiche événement.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Prep</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Priorité</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Aucun événement dans cette vue.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((event) => (
                  <TableRow key={event._id}>
                    <TableCell className="max-w-[420px]">
                      <Link href={`/communication/event/${event._id}`} className="font-medium hover:underline">
                        {event.title}
                      </Link>
                      {event.endDate && event.endDate !== event.startDate ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Jusqu&apos;au {compactDate(event.endDate)}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{EDITORIAL_EVENT_CATEGORY_LABELS[event.category]}</Badge>
                    </TableCell>
                    <TableCell>{compactDate(event.prepStartDate)}</TableCell>
                    <TableCell>{compactDate(event.startDate)}</TableCell>
                    <TableCell>
                      <p className="text-sm">
                        {profileNames.get(event.ownerProfileId) ?? "Membre"}
                      </p>
                      {event.backupOwnerProfileId ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Backup: {profileNames.get(event.backupOwnerProfileId) ?? "Membre"}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{EDITORIAL_EVENT_STATUS_LABELS[event.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{EDITORIAL_EVENT_PRIORITY_LABELS[event.priority]}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EditorialEventCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultStartDate={defaultDate}
        defaultOwnerProfileId={currentProfile?._id}
        triggerLabel="Créer l'événement"
      />
    </div>
  );
}
