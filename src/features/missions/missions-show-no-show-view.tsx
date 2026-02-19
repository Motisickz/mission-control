"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowUpDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePillPicker } from "@/components/ui/date-pill-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type ShowNoShowRow = Doc<"showNoShow">;

type SortDirection = "desc" | "asc";

const LIEUX = ["studio", "zoom"] as const;
const CONFIRME_VALUES = ["Oui", "Non"] as const;
const PRESENCE_VALUES = ["Show", "No Show", "Annulé par l'artiste"] as const;
const VENTE_VALUES = ["Oui", "Non", "Devis envoyé"] as const;
const TYPE_VENTE_VALUES = ["Compo/Arrangement", "Prise de voix"] as const;
export function MissionsShowNoShowView() {
  const currentProfile = useQuery(api.profiles.getCurrentProfile);
  const rows = useQuery(api.missionsTables.listShowNoShow);

  const createShowNoShow = useMutation(api.missionsTables.createShowNoShow);
  const updateShowNoShow = useMutation(api.missionsTables.updateShowNoShow);
  const deleteShowNoShow = useMutation(api.missionsTables.deleteShowNoShow);

  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [drafts, setDrafts] = useState<Record<string, Partial<ShowNoShowRow>>>({});

  const canAccess = currentProfile ? currentProfile.role === "admin" || currentProfile.role === "stagiaire" : true;

  const mergedRows = useMemo(() => {
    const source = rows ?? [];
    return source.map((row) => ({ ...row, ...(drafts[row._id] ?? {}) }));
  }, [rows, drafts]);

  const sortedRows = useMemo(() => {
    return mergedRows.slice().sort((a, b) => {
      const left = a.dateDuRdv || "";
      const right = b.dateDuRdv || "";
      if (sortDirection === "desc") return right.localeCompare(left);
      return left.localeCompare(right);
    });
  }, [mergedRows, sortDirection]);

  async function savePatch(rowId: ShowNoShowRow["_id"], patch: Partial<ShowNoShowRow>) {
    setDrafts((current) => ({
      ...current,
      [rowId]: {
        ...(current[rowId] ?? {}),
        ...patch,
      },
    }));

    try {
      await updateShowNoShow({ rowId, ...patch });
      toast.success("Ligne enregistrée.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast.error(`Échec de sauvegarde: ${message}`);

      const sourceRow = rows?.find((row) => row._id === rowId);
      if (!sourceRow) return;

      setDrafts((current) => {
        const rowDraft = { ...(current[rowId] ?? {}) } as Partial<ShowNoShowRow>;
        for (const key of Object.keys(patch) as (keyof ShowNoShowRow)[]) {
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
            <CardTitle>Show / No show</CardTitle>
            <CardDescription>Suivi des rendez-vous stagiaires.</CardDescription>
          </div>
          <Button
            onClick={async () => {
              try {
                await createShowNoShow({});
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
                <TableHead className="w-[210px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-2 h-8 px-2"
                    onClick={() => setSortDirection((value) => (value === "desc" ? "asc" : "desc"))}
                  >
                    DATE DU RDV
                    <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </TableHead>
                <TableHead className="w-[320px]">NOM</TableHead>
                <TableHead>LIEU DU RDV</TableHead>
                <TableHead>CONFIRMÉ</TableHead>
                <TableHead>PRÉSENCE</TableHead>
                <TableHead>VENTE</TableHead>
                <TableHead>TYPE DE VENTE</TableHead>
                <TableHead>Commentaires</TableHead>
                <TableHead className="w-[70px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    Aucune ligne.
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell className="w-[210px]">
                      <DatePillPicker
                        value={row.dateDuRdv || new Date().toISOString().slice(0, 10)}
                        compact
                        onValueChange={async (nextDate) => {
                          await savePatch(row._id, { dateDuRdv: nextDate });
                        }}
                      />
                    </TableCell>
                    <TableCell className="w-[320px]">
                      <Input
                        className="min-w-[280px]"
                        value={row.nom}
                        onChange={(event) => {
                          const value = event.target.value;
                          setDrafts((current) => ({
                            ...current,
                            [row._id]: {
                              ...(current[row._id] ?? {}),
                              nom: value,
                            },
                          }));
                        }}
                        onBlur={async () => {
                          await savePatch(row._id, { nom: row.nom });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.lieuDuRdv}
                        onValueChange={async (value) => {
                          await savePatch(row._id, { lieuDuRdv: value as ShowNoShowRow["lieuDuRdv"] });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LIEUX.map((value) => (
                            <SelectItem key={value} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.confirme}
                        onValueChange={async (value) => {
                          await savePatch(row._id, { confirme: value as ShowNoShowRow["confirme"] });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONFIRME_VALUES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.presence}
                        onValueChange={async (value) => {
                          await savePatch(row._id, { presence: value as ShowNoShowRow["presence"] });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRESENCE_VALUES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.vente}
                        onValueChange={async (value) => {
                          await savePatch(row._id, { vente: value as ShowNoShowRow["vente"] });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VENTE_VALUES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.typeDeVente}
                        onValueChange={async (value) => {
                          await savePatch(row._id, { typeDeVente: value as ShowNoShowRow["typeDeVente"] });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TYPE_VENTE_VALUES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                            await deleteShowNoShow({ rowId: row._id });
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
