export const PROJECT_FORMAT = "anime-hair-studio-project";
export const PROJECT_VERSION = 1;

export function projectFileName(name = "") {
  const safeName = String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${safeName || "anime-hair-project"}.ahs`;
}

export function validateHairProject(project) {
  if (project?.format !== PROJECT_FORMAT || Number(project.version) !== PROJECT_VERSION) {
    throw new Error("Unsupported Anime Hair Studio project format");
  }
  if (!project.state || !Array.isArray(project.state.locks) || !Array.isArray(project.state.guides)) {
    throw new Error("Project scene data is incomplete");
  }
  const record=(value,label)=>{
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`Invalid ${label}`);
  };
  const vectors=(value,label)=>{
    if(!Array.isArray(value)||value.some(p=>!p||!['x','y','z'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k]))))throw new Error(`Invalid ${label}: expected finite 3D points`);
  };
  for(const [i,lock] of project.state.locks.entries()){
    record(lock,`strand ${i+1}`);
    if(lock.points!==undefined)vectors(lock.points,`strand ${i+1} points`);
    for(const key of ['hairShellBasePoints','scalpBuilderEditedPoints'])if(lock[key]!=null)vectors(lock[key],key);
    for(const key of ['polyFaces','hairShellBaseFaces'])if(lock[key]!=null){
      const points=key==='polyFaces'?lock.points:lock.hairShellBasePoints;
      if(!Array.isArray(lock[key])||lock[key].some(f=>!Array.isArray(f)||f.length<3||f.some(v=>!Number.isInteger(v)||v<0||!points?.[v])))throw new Error(`Invalid ${key}`);
    }
  }
  project.state.guides.forEach((guide,i)=>{record(guide,`guide ${i+1}`);if(guide.points!=null)vectors(guide.points,`guide ${i+1} points`);});
  for(const key of ['referenceImages','greasePencilStrokes','hairMaterials','selectedControlPoints'])if(project.state[key]!=null&&!Array.isArray(project.state[key]))throw new Error(`Invalid ${key}`);
  return project;
}

export function createHairProject({
  name,
  state,
  strandGroups,
  headAsset = null,
  headAssetOmitted = false,
  scalpGuideAsset = null,
  preset = null,
  previewImage = null,
  savedAt = new Date().toISOString()
}) {
  const cleanState = { ...state, pendingPlacedLockId: null };
  const groupCounts = Object.fromEntries(strandGroups.map((group) => [
    group.id,
    cleanState.locks.filter((lock) => (lock.scalpRegion || "unassigned") === group.id).length
  ]));
  const metadata = {
    name,
    authoredBy: "human",
    savedAt,
    strandCount: cleanState.locks.length,
    guideCount: cleanState.guides.length,
    groupCounts
  };
  if (preset) metadata.preset = { ...preset };
  if (typeof previewImage === "string" && previewImage.startsWith("data:image/")) {
    metadata.previewImage = previewImage;
  }
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    application: "Anime Hair Studio",
    metadata,
    headAsset: headAsset ? { ...headAsset } : null,
    headAssetOmitted: Boolean(headAssetOmitted),
    scalpGuideAsset: scalpGuideAsset ? { ...scalpGuideAsset } : null,
    state: cleanState
  };
}
