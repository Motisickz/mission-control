"use client";

import { useMemo, useState } from "react";
import { CalendarPlus2 } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import {
  EDITORIAL_EVENT_CATEGORIES,
  EDITORIAL_EVENT_CATEGORY_LABELS,
  EDITORIAL_EVENT_PRIORITIES,
  EDITORIAL_EVENT_PRIORITY_LABELS,
  EDITORIAL_EVENT_STATUSES,
  EDITORIAL_EVENT_STATUS_LABELS,
} from "@/lib/domain-constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePillPicker } from "@/components/ui/date-pill-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type TemplateMode = "auto" | "now" | "none";

export function EditorialEventCreateDialog({
  open,
  onOpenChange,
  defaultStartDate,
  defaultOwnerProfileId,
  onCreated,
  triggerLabel = "Ajouter",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStartDate: string;
  defaultOwnerProfileId?: string;
  onCreated?: (eventId: string) => void;
  triggerLabel?: string;
}) {
  const formKey = `${open ? "open" : "closed"}:${defaultStartDate}:${defaultOwnerProfileId ?? ""}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nouvel événement éditorial</DialogTitle>
          <DialogDescription>
            Un événement Communication (soldes, interne) avec une date de préparation et des tâches.
          </DialogDescription>
        </DialogHeader>

        <EditorialEventCreateForm
          key={formKey}
          defaultStartDate={defaultStartDate}
          defaultOwnerProfileId={defaultOwnerProfileId}
          onOpenChange={onOpenChange}
          onCreated={onCreated}
          triggerLabel={triggerLabel}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditorialEventCreateForm({
  defaultStartDate,
  defaultOwnerProfileId,
  onOpenChange,
  onCreated,
  triggerLabel,
}: {
  defaultStartDate: string;
  defaultOwnerProfileId?: string;
  onOpenChange: (open: boolean) => void;
  onCreated?: (eventId: string) => void;
  triggerLabel: string;
}) {
  const profiles = useQuery(api.profiles.listVisibleProfiles);
  const currentProfile = useQuery(api.profiles.getCurrentProfile);
  const createEvent = useMutation(api.communication.createEditorialEvent);

  const [category, setCategory] = useState<(typeof EDITORIAL_EVENT_CATEGORIES)[keyof typeof EDITORIAL_EVENT_CATEGORIES]>(
    "interne",
  );
  const [priority, setPriority] = useState<(typeof EDITORIAL_EVENT_PRIORITIES)[keyof typeof EDITORIAL_EVENT_PRIORITIES]>(
    "moyen",
  );
  const [status, setStatus] = useState<(typeof EDITORIAL_EVENT_STATUSES)[keyof typeof EDITORIAL_EVENT_STATUSES]>(
    "a_preparer",
  );
  const [ownerProfileId, setOwnerProfileId] = useState<string>(defaultOwnerProfileId ?? "");
  const [backupOwnerProfileId, setBackupOwnerProfileId] = useState<string>("none");
  const [hasEndDate, setHasEndDate] = useState(false);
  const [templateMode, setTemplateMode] = useState<TemplateMode>("auto");

  const effectiveOwner = useMemo(() => {
    return ownerProfileId || defaultOwnerProfileId || currentProfile?._id || profiles?.[0]?._id || "";
  }, [ownerProfileId, defaultOwnerProfileId, currentProfile, profiles]);

  return (
    <form
      className="grid gap-x-4 gap-y-4 md:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const formEl = event.currentTarget;
        const form = new FormData(formEl);
        if (!effectiveOwner) return;

        try {
          const startDate = String(form.get("startDate") ?? defaultStartDate);
          const prepStartDate = String(form.get("prepStartDate") ?? defaultStartDate);
          const endDate = hasEndDate ? String(form.get("endDate") ?? "") : "";
          const notes = String(form.get("notes") ?? "");
          const title = String(form.get("title") ?? "").trim();

          const templateArgs =
            templateMode === "none"
              ? { autoCreateTemplateTasks: false, applyTemplateNow: false }
              : templateMode === "now"
                ? { autoCreateTemplateTasks: false, applyTemplateNow: true }
                : { autoCreateTemplateTasks: true, applyTemplateNow: false };

          const result = await createEvent({
            title,
            category,
            startDate,
            endDate: endDate ? endDate : undefined,
            prepStartDate,
            priority,
            ownerProfileId: effectiveOwner as never,
            backupOwnerProfileId: backupOwnerProfileId === "none" ? undefined : (backupOwnerProfileId as never),
            status,
            notes: notes.trim() ? notes : undefined,
            ...templateArgs,
          });

          toast.success("Événement créé.");
          formEl.reset();
          onOpenChange(false);
          onCreated?.(result.eventId);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Impossible de créer cet événement.";
          toast.error(message);
        }
      }}
    >
      <div className="space-y-1 md:col-span-2">
        <Label>Titre</Label>
        <Input name="title" required placeholder="Ex: Soldes d'hiver 2026" />
      </div>

      <div className="space-y-1">
        <Label>Catégorie</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
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
        <Label>Priorité</Label>
        <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(EDITORIAL_EVENT_PRIORITIES).map((value) => (
              <SelectItem key={value} value={value}>
                {EDITORIAL_EVENT_PRIORITY_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Statut</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(EDITORIAL_EVENT_STATUSES).map((value) => (
              <SelectItem key={value} value={value}>
                {EDITORIAL_EVENT_STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Création des tâches (template)</Label>
        <Select value={templateMode} onValueChange={(v) => setTemplateMode(v as TemplateMode)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto à la date de préparation</SelectItem>
            <SelectItem value="now">Créer maintenant</SelectItem>
            <SelectItem value="none">Ne pas créer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Owner</Label>
        <Select value={effectiveOwner} onValueChange={setOwnerProfileId} required>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner" />
          </SelectTrigger>
          <SelectContent>
            {(profiles ?? []).map((profile) => (
              <SelectItem key={profile._id} value={profile._id}>
                {profile.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Backup (optionnel)</Label>
        <Select value={backupOwnerProfileId} onValueChange={setBackupOwnerProfileId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Aucun</SelectItem>
            {(profiles ?? []).map((profile) => (
              <SelectItem key={profile._id} value={profile._id}>
                {profile.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Date de l&apos;événement (début)</Label>
        <DatePillPicker name="startDate" defaultValue={defaultStartDate} />
      </div>

      <div className="space-y-1">
        <Label>Date de préparation</Label>
        <DatePillPicker name="prepStartDate" defaultValue={defaultStartDate} />
      </div>

      <div className="flex items-center gap-2 md:col-span-2">
        <Checkbox checked={hasEndDate} onCheckedChange={(checked) => setHasEndDate(checked === true)} />
        <Label className="text-sm">L&apos;événement a une date de fin</Label>
      </div>

      {hasEndDate ? (
        <div className="space-y-1 md:col-span-2">
          <Label>Date de fin</Label>
          <DatePillPicker name="endDate" defaultValue={defaultStartDate} />
        </div>
      ) : null}

      <div className="space-y-1 md:col-span-2">
        <Label>Notes</Label>
        <Textarea name="notes" placeholder="Brief, liens, remarques..." />
      </div>

      <div className="md:col-span-2">
        <Button type="submit" className="w-full">
          <CalendarPlus2 className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      </div>
    </form>
  );
}
