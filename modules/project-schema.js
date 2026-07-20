export const PROJECT_FORMAT = "anime-hair-studio-project";
export const PROJECT_VERSION = 1;

export function projectFileName(name = "") {
  const safeName = String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${safeName || "anime-hair-project"}.animehair.json`;
}

export function validateHairProject(project) {
  if (project?.format !== PROJECT_FORMAT || Number(project.version) !== PROJECT_VERSION) {
    throw new Error("Unsupported Anime Hair Studio project format");
  }
  if (!project.state || !Array.isArray(project.state.locks) || !Array.isArray(project.state.guides)) {
    throw new Error("Project scene data is incomplete");
  }
  return project;
}

export function createHairProject({
  name,
  state,
  strandGroups,
  headAsset = null,
  scalpGuideAsset = null,
  savedAt = new Date().toISOString()
}) {
  const cleanState = { ...state, pendingPlacedLockId: null };
  const groupCounts = Object.fromEntries(strandGroups.map((group) => [
    group.id,
    cleanState.locks.filter((lock) => (lock.scalpRegion || "unassigned") === group.id).length
  ]));
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    application: "Anime Hair Studio",
    metadata: {
      name,
      authoredBy: "human",
      savedAt,
      strandCount: cleanState.locks.length,
      guideCount: cleanState.guides.length,
      groupCounts
    },
    headAsset: headAsset ? { ...headAsset } : null,
    scalpGuideAsset: scalpGuideAsset ? { ...scalpGuideAsset } : null,
    state: cleanState
  };
}
