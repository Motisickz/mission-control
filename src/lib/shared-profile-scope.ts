const SHARED_CONTACT_IDENTIFIER = "contact@hedayatmusic.com";

type ProfileLike = {
  _id: string;
  email?: string;
};

type TaskLike = {
  assigneeProfileId: string;
  assigneeProfileIds?: string[];
};

function normalizeEmail(value?: string | null) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function getSharedScopeProfileIds(
  currentProfile?: ProfileLike | null,
  visibleProfiles?: ProfileLike[] | null,
) {
  if (!currentProfile) return [];
  const currentEmail = normalizeEmail(currentProfile.email);
  if (currentEmail !== SHARED_CONTACT_IDENTIFIER) {
    return [currentProfile._id];
  }

  const matching = (visibleProfiles ?? []).filter(
    (profile) => normalizeEmail(profile.email) === SHARED_CONTACT_IDENTIFIER,
  );
  const ids = new Set<string>([currentProfile._id, ...matching.map((profile) => profile._id)]);
  return [...ids];
}

export function isAssignedToAnyProfile(task: TaskLike, profileIds: string[]) {
  if (profileIds.length === 0) return false;
  if (profileIds.includes(task.assigneeProfileId)) return true;
  return !!task.assigneeProfileIds?.some((profileId) => profileIds.includes(profileId));
}
