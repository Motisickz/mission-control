import { useMemo, useState } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";

import type { BoardProfileDoc } from "./board-types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type CreateSpaceDialogProps = {
  profiles: BoardProfileDoc[];
  onCreate: (payload: {
    name: string;
    description?: string;
    color?: string;
    visibility: "private" | "shared";
    memberIds: Id<"profiles">[];
  }) => Promise<void>;
};

export function CreateSpaceDialog({ profiles, onCreate }: CreateSpaceDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#2563EB");
  const [visibility, setVisibility] = useState<"private" | "shared">("shared");
  const [memberIds, setMemberIds] = useState<Id<"profiles">[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const sortedProfiles = useMemo(
    () =>
      profiles
        .slice()
        .sort((a, b) => a.displayName.localeCompare(b.displayName, "fr")),
    [profiles],
  );

  function toggleMember(profileId: Id<"profiles">) {
    setMemberIds((current) =>
      current.includes(profileId)
        ? current.filter((id) => id !== profileId)
        : [...current, profileId],
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">Créer un espace</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Créer un espace</DialogTitle>
          <DialogDescription>
            Choisissez le type d&apos;espace et les membres autorisés.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Nom</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nom de l'espace" />
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description (optionnelle)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Couleur</Label>
              <Input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-10" />
            </div>

            <div className="space-y-1">
              <Label>Visibilité</Label>
              <Select value={visibility} onValueChange={(value) => setVisibility(value as typeof visibility)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shared">Partagé</SelectItem>
                  <SelectItem value="private">Privé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Membres autorisés</Label>
            <ScrollArea className="h-44 rounded-md border border-border/70 p-2">
              <div className="space-y-2 pr-2">
                {sortedProfiles.map((profile) => (
                  <label
                    key={profile._id}
                    className="flex items-center gap-2 rounded-md border border-border/70 px-2 py-1.5 text-sm"
                  >
                    <Checkbox
                      checked={memberIds.includes(profile._id)}
                      onCheckedChange={() => toggleMember(profile._id)}
                    />
                    <span>{profile.displayName}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            type="button"
            disabled={submitting || name.trim().length === 0}
            onClick={async () => {
              if (!name.trim()) return;
              setSubmitting(true);
              try {
                await onCreate({
                  name: name.trim(),
                  description: description.trim() || undefined,
                  color: color || undefined,
                  visibility,
                  memberIds,
                });
                setOpen(false);
                setName("");
                setDescription("");
                setMemberIds([]);
                setVisibility("shared");
                setColor("#2563EB");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
