import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Copy, ListChecks, Tag } from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";

import type { BoardProfileDoc, BoardTaskDoc } from "./board-types";
import { getTagChipStyle, taskChecklist } from "./board-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type CardDetailDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: BoardTaskDoc | null;
  profiles: BoardProfileDoc[];
  onSave: (
    cardId: Id<"tasks">,
    payload: {
      title: string;
      description: string | null;
      notes: string | null;
      dueDate: string | null;
      priority: "urgent" | "high" | "medium" | "low";
      assigneeProfileIds: Id<"profiles">[];
      tags: string[];
    },
  ) => Promise<void>;
  onToggleChecklist: (cardId: Id<"tasks">, itemId: string) => Promise<void>;
  onAddChecklistItem: (cardId: Id<"tasks">, text: string) => Promise<void>;
  onDuplicateRequest: (cardId: Id<"tasks">) => void;
  onDelete: (cardId: Id<"tasks">) => Promise<void>;
};

type DescriptionChecklistLine = {
  lineIndex: number;
  text: string;
  done: boolean;
};

function parseDescriptionChecklist(value: string): DescriptionChecklistLine[] {
  const lines = value.split(/\r?\n/);
  const parsed: DescriptionChecklistLine[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const match = line.match(/^\s*-\s+\[( |x|X)\]\s+(.*)$/);
    if (!match) continue;
    parsed.push({
      lineIndex: index,
      done: match[1].toLowerCase() === "x",
      text: (match[2] ?? "").trim(),
    });
  }

  return parsed;
}

function setDescriptionChecklistState(value: string, lineIndex: number, done: boolean) {
  const lines = value.split(/\r?\n/);
  const line = lines[lineIndex] ?? "";
  const match = line.match(/^\s*-\s+\[( |x|X)\]\s+(.*)$/);
  if (!match) return value;
  lines[lineIndex] = `- [${done ? "x" : " "}] ${(match[2] ?? "").trim()}`;
  return lines.join("\n");
}

function appendDescriptionChecklistLine(value: string, text: string) {
  const clean = text.trim();
  if (!clean) return value;
  const nextLine = `- [ ] ${clean}`;
  if (!value.trim()) return nextLine;
  return `${value.replace(/\s+$/u, "")}\n${nextLine}`;
}

export function CardDetailDrawer({
  open,
  onOpenChange,
  task,
  profiles,
  onSave,
  onToggleChecklist,
  onAddChecklistItem,
  onDuplicateRequest,
  onDelete,
}: CardDetailDrawerProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<"urgent" | "high" | "medium" | "low">("medium");
  const [assigneeIds, setAssigneeIds] = useState<Id<"profiles">[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [descriptionActionInput, setDescriptionActionInput] = useState("");
  const [checklistInput, setChecklistInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [checklistBusy, setChecklistBusy] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setNotes(task.notes ?? task.note ?? "");
    setDueDate(task.dueDate ?? "");
    setPriority(task.priority);
    setAssigneeIds(task.assigneeProfileIds?.length ? task.assigneeProfileIds : [task.assigneeProfileId]);
    setTags(task.tags ?? []);
    setTagInput("");
    setDescriptionActionInput("");
    setChecklistInput("");
  }, [task]);

  const checklist = useMemo(() => (task ? taskChecklist(task) : []), [task]);
  const descriptionChecklist = useMemo(
    () => parseDescriptionChecklist(description),
    [description],
  );

  function toggleAssignee(profileId: Id<"profiles">) {
    setAssigneeIds((current) => {
      if (current.includes(profileId)) {
        if (current.length === 1) return current;
        return current.filter((id) => id !== profileId);
      }
      return [...current, profileId];
    });
  }

  function addTag() {
    const value = tagInput.trim();
    if (!value) return;
    setTags((current) => (current.includes(value) ? current : [...current, value]));
    setTagInput("");
  }

  if (!task) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl" side="right">
          <SheetHeader>
            <SheetTitle>Détail carte</SheetTitle>
            <SheetDescription>Sélectionne une carte pour l&apos;éditer.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-2xl" side="right">
        <SheetHeader className="border-b border-border/70">
          <SheetTitle>Détail carte</SheetTitle>
          <SheetDescription>Édition rapide du contenu, checklist et metadata.</SheetDescription>
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => onDuplicateRequest(task.cardId)}>
              <Copy className="h-4 w-4" />
              Dupliquer
            </Button>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <section className="space-y-3 rounded-xl border border-border/70 p-3">
            <div className="space-y-1">
              <Label>Titre</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Description de la carte"
              />
            </div>
            <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-2.5">
              <Label>Actions (dans le descriptif)</Label>
              {descriptionChecklist.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Ajoute des actions puis coche-les ici. Le descriptif sera enregistré en format checklist.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {descriptionChecklist.map((item) => (
                    <label key={`${item.lineIndex}-${item.text}`} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={item.done}
                        onCheckedChange={(checked) => {
                          setDescription((current) =>
                            setDescriptionChecklistState(current, item.lineIndex, !!checked),
                          );
                        }}
                      />
                      <span className={item.done ? "line-through text-muted-foreground" : ""}>{item.text}</span>
                    </label>
                  ))}
                </div>
              )}
              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!descriptionActionInput.trim()) return;
                  setDescription((current) =>
                    appendDescriptionChecklistLine(current, descriptionActionInput),
                  );
                  setDescriptionActionInput("");
                }}
              >
                <Input
                  value={descriptionActionInput}
                  onChange={(event) => setDescriptionActionInput(event.target.value)}
                  placeholder="Ajouter une action à cocher"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={descriptionActionInput.trim().length === 0}
                >
                  Ajouter
                </Button>
              </form>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Notes internes"
              />
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-border/70 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4" />
                  Date limite
                </Label>
                <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </div>

              <div className="space-y-1">
                <Label>Priorité</Label>
                <Select value={priority} onValueChange={(value) => setPriority(value as typeof priority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">Élevé</SelectItem>
                    <SelectItem value="medium">Moyen</SelectItem>
                    <SelectItem value="low">Faible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Assignations</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {profiles.map((profile) => (
                  <label
                    key={profile._id}
                    className="flex items-center gap-2 rounded-md border border-border/70 px-2.5 py-2 text-sm"
                  >
                    <Checkbox
                      checked={assigneeIds.includes(profile._id)}
                      onCheckedChange={() => toggleAssignee(profile._id)}
                    />
                    <span>{profile.displayName}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1.5">
                <Tag className="h-4 w-4" />
                Tags
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTags((current) => current.filter((value) => value !== tag))}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs"
                    style={getTagChipStyle(tag)}
                  >
                    {tag}
                    <span aria-hidden>×</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  placeholder="Ajouter un tag"
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    addTag();
                  }}
                />
                <Button type="button" variant="secondary" onClick={addTag}>Ajouter</Button>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-border/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="inline-flex items-center gap-1.5">
                <ListChecks className="h-4 w-4" />
                Checklist
              </Label>
              <Badge variant="secondary">{checklist.filter((item) => item.done).length}/{checklist.length}</Badge>
            </div>

            {checklist.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun item checklist.</p>
            ) : (
              <div className="space-y-2">
                {checklist.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-2 rounded-md border border-border/70 px-2.5 py-2 text-sm"
                  >
                    <Checkbox
                      checked={item.done}
                      onCheckedChange={async () => {
                        if (checklistBusy) return;
                        setChecklistBusy(true);
                        try {
                          await onToggleChecklist(task.cardId, item.id);
                        } finally {
                          setChecklistBusy(false);
                        }
                      }}
                    />
                    <span className={item.done ? "line-through text-muted-foreground" : ""}>{item.text}</span>
                  </label>
                ))}
              </div>
            )}

            <form
              className="flex items-center gap-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const value = checklistInput.trim();
                if (!value || checklistBusy) return;
                setChecklistBusy(true);
                try {
                  await onAddChecklistItem(task.cardId, value);
                  setChecklistInput("");
                } finally {
                  setChecklistBusy(false);
                }
              }}
            >
              <Input
                value={checklistInput}
                onChange={(event) => setChecklistInput(event.target.value)}
                placeholder="Ajouter un item"
                disabled={checklistBusy}
              />
              <Button type="submit" variant="secondary" disabled={checklistBusy || checklistInput.trim().length === 0}>
                Ajouter
              </Button>
            </form>
          </section>

        </div>

        <SheetFooter className="border-t border-border/70 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="destructive"
            disabled={saving}
            onClick={async () => {
              const confirmed = window.confirm("Supprimer cette carte de cet espace ?");
              if (!confirmed) return;
              setSaving(true);
              try {
                await onDelete(task.cardId);
                onOpenChange(false);
              } finally {
                setSaving(false);
              }
            }}
          >
            Supprimer
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Fermer
          </Button>
          <Button
            type="button"
            disabled={saving || title.trim().length === 0}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(task.cardId, {
                  title: title.trim(),
                  description: description.trim() ? description.trim() : null,
                  notes: notes.trim() ? notes.trim() : null,
                  dueDate: dueDate || null,
                  priority,
                  assigneeProfileIds: assigneeIds.length > 0 ? assigneeIds : [task.assigneeProfileId],
                  tags,
                });
                onOpenChange(false);
              } finally {
                setSaving(false);
              }
            }}
          >
            Enregistrer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
