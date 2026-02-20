import { Search, SlidersHorizontal, Tag } from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";

import type { BoardFilter, BoardProfileDoc, BoardSpaceDoc } from "./board-types";
import { getTagChipStyle } from "./board-types";
import { CreateSpaceDialog } from "./create-space-dialog";
import { SpaceSwitcher } from "./space-switcher";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type BoardHeaderProps = {
  spaces: BoardSpaceDoc[];
  selectedSpaceId: Id<"spaces"> | null;
  onSpaceChange: (spaceId: Id<"spaces">) => void;
  directoryProfiles: BoardProfileDoc[];
  onCreateSpace: (payload: {
    name: string;
    description?: string;
    color?: string;
    visibility: "private" | "shared";
    memberIds: Id<"profiles">[];
  }) => Promise<void>;
  taskFilter: BoardFilter;
  onTaskFilterChange: (value: BoardFilter) => void;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  tagOptions: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
};

const FILTER_OPTIONS: Array<{ key: BoardFilter; label: string }> = [
  { key: "all", label: "Tout" },
  { key: "urgent", label: "Urgentes" },
  { key: "mine", label: "Assignées à moi" },
];

export function BoardHeader({
  spaces,
  selectedSpaceId,
  onSpaceChange,
  directoryProfiles,
  onCreateSpace,
  taskFilter,
  onTaskFilterChange,
  searchValue,
  onSearchValueChange,
  tagOptions,
  selectedTags,
  onToggleTag,
  onClearTags,
}: BoardHeaderProps) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/80 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <SpaceSwitcher
          spaces={spaces}
          selectedSpaceId={selectedSpaceId}
          onChange={onSpaceChange}
        />
        <CreateSpaceDialog profiles={directoryProfiles} onCreate={onCreateSpace} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-border/70 bg-muted/40 p-1">
          {FILTER_OPTIONS.map((option) => (
            <Button
              key={option.key}
              type="button"
              variant={taskFilter === option.key ? "secondary" : "ghost"}
              size="sm"
              className={cn("h-8 rounded-md px-3 text-xs", taskFilter !== option.key && "text-muted-foreground")}
              onClick={() => onTaskFilterChange(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchValueChange(event.target.value)}
            placeholder="Rechercher une carte"
            className="pl-8"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Tags</span>
        </div>

        {tagOptions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun tag pour le moment.</p>
        ) : (
          tagOptions.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onToggleTag(tag)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  active ? "ring-2 ring-primary/30" : "hover:brightness-[0.98]",
                )}
                style={getTagChipStyle(tag, active)}
              >
                <Tag className="h-3 w-3" />
                {tag}
              </button>
            );
          })
        )}

        {selectedTags.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearTags}>
            Réinitialiser
          </Button>
        ) : null}

        {selectedTags.length > 0 ? <Badge variant="secondary">{selectedTags.length} actif(s)</Badge> : null}
      </div>
    </section>
  );
}
