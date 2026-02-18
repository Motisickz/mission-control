import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const SHARED_CONTACT_IDENTIFIER = "contact@hedayatmusic.com";

type Role = "admin" | "stagiaire";
type ScopedProfile = {
  _id: Id<"profiles">;
  email: string;
};

function normalizeEmail(value?: string | null) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isSharedContactEmail(email?: string | null) {
  return normalizeEmail(email) === SHARED_CONTACT_IDENTIFIER;
}

export async function getAccessProfileIds(
  ctx: QueryCtx | MutationCtx,
  profile: ScopedProfile,
) {
  const self = profile._id;
  if (!isSharedContactEmail(profile.email)) {
    return [self];
  }

  const sharedProfiles = await ctx.db
    .query("profiles")
    .withIndex("by_email", (q) => q.eq("email", SHARED_CONTACT_IDENTIFIER))
    .collect();

  const unique = new Set<Id<"profiles">>([self]);
  for (const item of sharedProfiles) {
    unique.add(item._id);
  }
  return [...unique];
}

export function hasProfileAccess(
  role: Role,
  accessProfileIds: Id<"profiles">[],
  taskAssigneeId: Id<"profiles">,
  taskAssigneeIds?: Id<"profiles">[],
) {
  if (role === "admin") return true;
  const allowed = new Set(accessProfileIds);
  if (allowed.has(taskAssigneeId)) return true;
  return !!taskAssigneeIds?.some((id) => allowed.has(id));
}

export function areAllInAccessScope(
  accessProfileIds: Id<"profiles">[],
  candidateProfileIds: Id<"profiles">[],
) {
  const allowed = new Set(accessProfileIds);
  return candidateProfileIds.every((id) => allowed.has(id));
}
