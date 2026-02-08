"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ROLE_LABELS } from "@/lib/domain-constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ProfilsView() {
  const current = useQuery(api.profiles.getCurrentProfile);
  const profiles = useQuery(api.profiles.listVisibleProfiles);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Environnement actif</CardTitle>
          <CardDescription>Profil utilisé pour l&apos;espace de travail courant.</CardDescription>
        </CardHeader>
        <CardContent>
          {current ? (
            <div className="flex items-center justify-between rounded-md border border-border/70 p-3">
              <div>
                <p className="font-medium">{current.displayName}</p>
                <p className="text-sm text-muted-foreground">{current.email}</p>
              </div>
              <Badge>{ROLE_LABELS[current.role]}</Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Membres</CardTitle>
          <CardDescription>Liste visible selon vos droits.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(profiles ?? []).map((profile) => (
            <div key={profile._id} className="rounded-md border border-border/70 p-3">
              <p className="font-medium">{profile.displayName}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              <Badge className="mt-2" variant="secondary">
                {ROLE_LABELS[profile.role]}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
