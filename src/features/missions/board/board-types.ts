import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import type { CSSProperties } from "react";

export type BoardFilter = "all" | "urgent" | "mine";
export type BoardColumnDoc = Doc<"boardColumns">;
export type BoardSpaceDoc = Doc<"spaces"> & { label?: string };
export type BoardTaskDoc = Doc<"tasks"> & {
  instanceId: Id<"boardCardInstances">;
  cardId: Id<"tasks">;
  columnId: Id<"boardColumns">;
  order: number;
};
export type BoardProfileDoc = Doc<"profiles">;

export type BoardChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export function taskAssigneeIds(task: BoardTaskDoc) {
  if (task.assigneeProfileIds && task.assigneeProfileIds.length > 0) {
    return task.assigneeProfileIds;
  }
  return [task.assigneeProfileId];
}

export function taskChecklist(task: BoardTaskDoc): BoardChecklistItem[] {
  return (task.checklist ?? []).map((item) => ({
    id: item.id,
    text: item.text ?? item.label,
    done: item.done,
  }));
}

export function hasTaskAssignee(task: BoardTaskDoc, profileId: Id<"profiles">) {
  return taskAssigneeIds(task).includes(profileId);
}

export function formatBoardDate(iso?: string) {
  if (!iso) return null;
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function profileInitials(nameOrEmail: string) {
  const parts = nameOrEmail.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function hashTag(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) {
    hash = (hash * 31 + tag.charCodeAt(i)) % 360;
  }
  return hash;
}

export function getTagHue(tag: string) {
  return hashTag(tag);
}

export function getTagChipStyle(tag: string, active = false): CSSProperties {
  const hue = getTagHue(tag);
  return {
    backgroundColor: active ? `oklch(0.9 0.06 ${hue})` : `oklch(0.95 0.03 ${hue})`,
    borderColor: `oklch(0.78 0.08 ${hue})`,
    color: `oklch(0.4 0.1 ${hue})`,
  };
}
