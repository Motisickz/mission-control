"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowUpDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type MissedCallRow = Doc<"missedCalls">;

type SortDirection = "desc" | "asc";

export function MissionsMissedCallsView() {
  const currentProfile = useQuery(api.profiles.getCurrentProfile);
  const rows = useQuery(api.missionsTables.listMissedCalls);

  const createMissedCall = useMutation(api.missionsTables.createMissedCall);
  const updateMissedCall = useMutation(api.missionsTables.updateMissedCall);
  const deleteMissedCall = useMutation(api.missionsTables.deleteMissedCall);

  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [drafts, setDrafts] = useState<Record<string, Partial<MissedCallRow>>>({});

  const canAccess = currentProfile ? currentProfile.role === "admin" || currentProfile.role === "stagiaire" : true;

  const mergedRows = useMemo(() => {
    const source = rows ?? [];
    return source.map((row) => ({ ...row, ...(drafts[row._id] ?? {}) }));
  }, [rows, drafts]);

  const sortedRows = useMemo(() => {
    return mergedRows.slice().sort((a, b) => {
      const left = a.dateEtHoraireAppelManque || "";
      const right = b.dateEtHoraireAppelManque || "";
      if (sortDirection === "desc") return right.localeCompare(left);
      return left.localeCompare(right);
    });
  }, [mergedRows, sortDirection]);

  async function savePatch(rowId: MissedCallRow["_id"], patch: Partial<MissedCallRow>) {
    setDrafts((current) => ({
      ...current,
      [rowId]: {
        ...(current[rowId] ?? {}),
        ...patch,
      },
    }));

    try {
      await updateMissedCall({ rowId, ...patch });
      toast.success("Ligne enregistrée.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast.error(`Échec de sauvegarde: ${message}`);

      const sourceRow = rows?.find((row) => row._id === rowId);
      if (!sourceRow) return;

      setDrafts((current) => {
        const rowDraft = { ...(current[rowId] ?? {}) } as Partial<MissedCallRow>;
        for (const key of Object.keys(patch) as (keyof MissedCallRow)[]) {
          rowDraft[key] = sourceRow[key];
        }
        return { ...current, [rowId]: rowDraft };
      });
    }
  }

  if (!canAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accès non autorisé</CardTitle>
          <CardDescription>Tu n&apos;as pas les permissions pour cette page.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/90">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Appels manqués</CardTitle>
            <CardDescription>Suivi des rappels stagiaires.</CardDescription>
          </div>
          <Button
            onClick={async () => {
              try {
                await createMissedCall({});
                toast.success("Nouvelle ligne ajoutée.");
              } catch (error) {
                const message = error instanceof Error ? error.message : "Erreur inconnue";
                toast.error(`Création impossible: ${message}`);
              }
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            + Ajouter une ligne
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-2 h-8 px-2"
                    onClick={() => setSortDirection((value) => (value === "desc" ? "asc" : "desc"))}
                  >
                    Date et horaire de l&apos;appel manqué
                    <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </TableHead>
                <TableHead className="w-[320px]">Numéro de tél</TableHead>
                <TableHead>Contact Hubspot</TableHead>
                <TableHead>Message vocal</TableHead>
                <TableHead>Rappelé 1 fois (ASAP)</TableHead>
                <TableHead>Rappelé 2 fois (J+1)</TableHead>
                <TableHead>Commentaires</TableHead>
                <TableHead className="w-[70px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Aucune ligne.
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell className="w-[280px]">
                      <Input
                        value={row.dateEtHoraireAppelManque}
                        placeholder="Ex: 19 févr. 2026, 14:30"
                        onChange={(event) => {
                          const value = event.target.value;
                          setDrafts((current) => ({
                            ...current,
                            [row._id]: {
                              ...(current[row._id] ?? {}),
                              dateEtHoraireAppelManque: value,
                            },
                          }));
                        }}
                        onBlur={async () => {
                          await savePatch(row._id, {
                            dateEtHoraireAppelManque: row.dateEtHoraireAppelManque,
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="w-[320px]">
                      <Input
                        className="min-w-[280px]"
                        value={row.numeroDeTel}
                        onChange={(event) => {
                          const value = event.target.value;
                          setDrafts((current) => ({
                            ...current,
                            [row._id]: {
                              ...(current[row._id] ?? {}),
                              numeroDeTel: value,
                            },
                          }));
                        }}
                        onBlur={async () => {
                          await savePatch(row._id, { numeroDeTel: row.numeroDeTel });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Input
                          type="url"
                          value={row.contactHubspot}
                          placeholder="https://..."
                          onChange={(event) => {
                            const value = event.target.value;
                            setDrafts((current) => ({
                              ...current,
                              [row._id]: {
                                ...(current[row._id] ?? {}),
                                contactHubspot: value,
                              },
                            }));
                          }}
                          onBlur={async () => {
                            await savePatch(row._id, { contactHubspot: row.contactHubspot });
                          }}
                        />
                        {row.contactHubspot ? (
                          <a
                            href={row.contactHubspot}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary underline underline-offset-2"
                          >
                            Ouvrir
                          </a>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={row.messageVocal}
                        onCheckedChange={async (checked) => {
                          await savePatch(row._id, { messageVocal: Boolean(checked) });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={row.rappele1foisAsap}
                        onCheckedChange={async (checked) => {
                          await savePatch(row._id, { rappele1foisAsap: Boolean(checked) });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={row.rappele2foisJ1}
                        onCheckedChange={async (checked) => {
                          await savePatch(row._id, { rappele2foisJ1: Boolean(checked) });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Textarea
                        className="min-h-10"
                        value={row.commentaires}
                        onChange={(event) => {
                          const value = event.target.value;
                          setDrafts((current) => ({
                            ...current,
                            [row._id]: {
                              ...(current[row._id] ?? {}),
                              commentaires: value,
                            },
                          }));
                        }}
                        onBlur={async () => {
                          await savePatch(row._id, { commentaires: row.commentaires });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!window.confirm("Supprimer cette ligne ?")) return;
                          try {
                            await deleteMissedCall({ rowId: row._id });
                            toast.success("Ligne supprimée.");
                          } catch (error) {
                            const message = error instanceof Error ? error.message : "Erreur inconnue";
                            toast.error(`Suppression impossible: ${message}`);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
