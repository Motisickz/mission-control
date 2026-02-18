"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CommunicationEventError({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <div className="space-y-6">
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Impossible d&apos;ouvrir la fiche</CardTitle>
          <CardDescription>
            L&apos;événement demandé est invalide, supprimé, ou inaccessible.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={reset}>Réessayer</Button>
          <Button variant="secondary" asChild>
            <Link href="/communication/events">Liste des événements</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/communication/calendar">Calendrier éditorial</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

