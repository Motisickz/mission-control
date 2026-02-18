"use client";

import { useState } from "react";
import { CalendarPlus2, ClipboardList, Lightbulb, Users } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import { todayIsoDate } from "@/lib/datetime";
import { TASK_ENTRY_TYPE_COLORS, TASK_ENTRY_TYPE_LABELS, TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/domain-constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePillPicker } from "@/components/ui/date-pill-picker";

type AddType = "task" | "meeting" | "event";

const ADD_OPTIONS: Record<
  AddType,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
    buttonClass: string;
  }
> = {
  task: {
    label: "Tâche",
    icon: ClipboardList,
    description: "Action exécutable avec échéance claire.",
    buttonClass: "bg-indigo-500/15 text-indigo-700 hover:bg-indigo-500/25",
  },
  meeting: {
    label: "Réunion",
    icon: Users,
    description: "Créneau de coordination avec l&apos;équipe.",
    buttonClass: "bg-cyan-500/15 text-cyan-700 hover:bg-cyan-500/25",
  },
  event: {
    label: "Événement",
    icon: Lightbulb,
    description: "Point marquant (lancement, deadline, demo...).",
    buttonClass: "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25",
  },
};

export function CalendrierAddView() {
  const profiles = useQuery(api.profiles.listVisibleProfiles);
  const currentProfile = useQuery(api.profiles.getCurrentProfile);
  const createTask = useMutation(api.tasks.createTask);

  const [open, setOpen] = useState(false);
  const [addType, setAddType] = useState<AddType>("task");
  const [priority, setPriority] = useState<"urgent" | "high" | "medium" | "low">("medium");
  const [recipientProfileId, setRecipientProfileId] = useState<string>("");
  const [formNonce, setFormNonce] = useState(0);

  const defaultRecipient = currentProfile?._id || profiles?.[0]?._id || "";
  const effectiveRecipient = recipientProfileId || defaultRecipient;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <Card className="overflow-hidden border-border/70 bg-card/90">
          <CardHeader className="relative pb-3">
            <div className="absolute -top-10 right-0 h-32 w-32 rounded-full bg-[color:oklch(0.9_0.07_62/.42)] blur-2xl" />
            <CardTitle className="flex items-center gap-2 text-xl">
              <CalendarPlus2 className="h-5 w-5 text-primary" />
              Ajouter à l&apos;agenda
            </CardTitle>
            <CardDescription>
              Choisis un type d&apos;entrée puis complète le formulaire dédié.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {(Object.keys(ADD_OPTIONS) as AddType[]).map((type) => {
              const option = ADD_OPTIONS[type];
              const Icon = option.icon;
              return (
                <button
                  key={type}
                  type="button"
                  className={`rounded-lg border border-border/70 p-3 text-left transition-colors ${option.buttonClass}`}
                  onClick={() => {
                    setAddType(type);
                    setPriority("medium");
                    setRecipientProfileId(defaultRecipient);
                    setFormNonce((value) => value + 1);
                    setOpen(true);
                  }}
                >
                  <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-current/35">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="font-medium">{option.label}</p>
                  <p className="mt-1 text-xs text-current/80">{option.description}</p>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle className="text-lg">Recommandations</CardTitle>
            <CardDescription>Vision structurée pour un agenda utilisable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Utilise une entrée = une intention claire (tâche, réunion ou événement).</p>
            <p>2. Toujours définir un créneau début/fin précis.</p>
            <p>3. Assigne un responsable unique.</p>
            <p>4. Mets la priorité uniquement si nécessaire pour éviter le bruit.</p>
          </CardContent>
        </Card>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouvelle entrée: {TASK_ENTRY_TYPE_LABELS[addType]}</DialogTitle>
            <DialogDescription>
              Cette page est dédiée au sous-menu Calendrier &gt; Ajouter.
            </DialogDescription>
          </DialogHeader>

          <form
            key={formNonce}
            className="grid gap-3 md:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              if (!effectiveRecipient) return;

              try {
                await createTask({
                  title: String(form.get("title") ?? ""),
                  description: String(form.get("description") ?? ""),
                  note: String(form.get("note") ?? ""),
                  assigneeProfileId: effectiveRecipient as never,
                  date: String(form.get("date") ?? todayIsoDate()),
                  dueDate: String(form.get("dueDate") ?? ""),
                  startTime: String(form.get("startTime") ?? "09:00"),
                  endTime: String(form.get("endTime") ?? "10:00"),
                  priority,
                  period: "none",
                  entryType: addType,
                  checklist: [],
                  calendarFilterIds: [],
                });

                toast.success(`${TASK_ENTRY_TYPE_LABELS[addType]} ajoutée à l'agenda.`);
                event.currentTarget.reset();
                setRecipientProfileId(defaultRecipient);
                setPriority("medium");
                setFormNonce((value) => value + 1);
                setOpen(false);
              } catch (error) {
                const message = error instanceof Error ? error.message : "Impossible d'ajouter cette entrée.";
                toast.error(message);
              }
            }}
          >
            <div className="space-y-1 md:col-span-2">
              <Label>Titre</Label>
              <Input name="title" required />
            </div>

            <div className="space-y-1">
              <Label>Assigné(e)</Label>
              <Select value={effectiveRecipient} onValueChange={setRecipientProfileId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {(profiles ?? []).map((profile) => (
                    <SelectItem key={profile._id} value={profile._id}>{profile.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Priorité</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as typeof priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(TASK_PRIORITIES).map((value) => (
                    <SelectItem key={value} value={value}>{TASK_PRIORITY_LABELS[value]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label>Description</Label>
              <Input name="description" />
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label>Note</Label>
              <Textarea name="note" placeholder="Contexte, objectif, livrable attendu..." />
            </div>

            <div className="space-y-1">
              <Label>Date</Label>
              <DatePillPicker name="date" defaultValue={todayIsoDate()} />
            </div>

            <div className="space-y-1">
              <Label>Échéance</Label>
              <DatePillPicker name="dueDate" defaultValue={todayIsoDate()} />
            </div>

            <div className="space-y-1">
              <Label>Début</Label>
              <Input name="startTime" type="time" defaultValue="09:00" />
            </div>

            <div className="space-y-1">
              <Label>Fin</Label>
              <Input name="endTime" type="time" defaultValue="10:00" />
            </div>

            <div className="md:col-span-2">
              <Button
                type="submit"
                className="w-full"
                style={{
                  backgroundColor: TASK_ENTRY_TYPE_COLORS[addType],
                  color: "oklch(0.2 0.03 260)",
                }}
              >
                Enregistrer {TASK_ENTRY_TYPE_LABELS[addType].toLowerCase()}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
