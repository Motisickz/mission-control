import type { Id } from "../../../../convex/_generated/dataModel";

import type { BoardSpaceDoc } from "./board-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SpaceSwitcherProps = {
  spaces: BoardSpaceDoc[];
  selectedSpaceId: Id<"spaces"> | null;
  onChange: (spaceId: Id<"spaces">) => void;
};

export function SpaceSwitcher({ spaces, selectedSpaceId, onChange }: SpaceSwitcherProps) {
  return (
    <div className="flex min-w-[240px] items-center gap-2">
      <span className="text-sm text-muted-foreground">Espace :</span>
      <Select
        value={selectedSpaceId ?? undefined}
        onValueChange={(value) => onChange(value as Id<"spaces">)}
        disabled={spaces.length === 0}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choisir un espace" />
        </SelectTrigger>
        <SelectContent>
          {spaces.map((space) => (
            <SelectItem key={space._id} value={space._id}>
              {space.label ?? space.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
