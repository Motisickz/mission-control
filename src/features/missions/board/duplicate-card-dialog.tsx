import { useMemo, useState } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";

import type { BoardSpaceDoc } from "./board-types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DuplicateCardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaces: BoardSpaceDoc[];
  currentSpaceId: Id<"spaces"> | null;
  onConfirm: (targetSpaceId: Id<"spaces">, syncWithOriginal: boolean) => Promise<void>;
};

export function DuplicateCardDialog({
  open,
  onOpenChange,
  spaces,
  currentSpaceId,
  onConfirm,
}: DuplicateCardDialogProps) {
  const availableTargets = useMemo(
    () => spaces.filter((space) => space._id !== currentSpaceId),
    [currentSpaceId, spaces],
  );

  const [targetSpaceId, setTargetSpaceId] = useState<Id<"spaces"> | null>(null);
  const [syncWithOriginal, setSyncWithOriginal] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setTargetSpaceId(null);
          setSyncWithOriginal(true);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dupliquer la carte</DialogTitle>
          <DialogDescription>
            Choisissez l&apos;espace destination et le mode de synchronisation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Espace destination</Label>
            <Select
              value={targetSpaceId ?? undefined}
              onValueChange={(value) => setTargetSpaceId(value as Id<"spaces">)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un espace" />
              </SelectTrigger>
              <SelectContent>
                {availableTargets.map((space) => (
                  <SelectItem key={space._id} value={space._id}>
                    {space.label ?? space.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm">
            <Checkbox
              checked={syncWithOriginal}
              onCheckedChange={(checked) => setSyncWithOriginal(!!checked)}
            />
            <span>Synchroniser avec l&apos;originale</span>
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={submitting} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            disabled={submitting || !targetSpaceId}
            onClick={async () => {
              if (!targetSpaceId) return;
              setSubmitting(true);
              try {
                await onConfirm(targetSpaceId, syncWithOriginal);
                onOpenChange(false);
                setTargetSpaceId(null);
                setSyncWithOriginal(true);
              } finally {
                setSubmitting(false);
              }
            }}
          >
            Dupliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
