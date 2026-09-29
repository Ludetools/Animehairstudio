export const importHeadGuideSteps = [
  { title: 'Open File', text: 'Click File to find the character import options.', targets: ['#fileMenuToggle'] },
  { title: 'Choose your character mesh', text: 'Choose Import Head Mesh or Import Full Body Mesh, then select an OBJ file. This step advances only after a successful import. Cancelled? Choose an option again.', targets: ['#importHeadMeshMenu', '#importFullBodyMeshMenu'] },
  { title: 'Fit the head', text: 'In Main, adjust Position Y, Position Z and Uniform Scale to fit your character. Orbit the viewport to inspect. Press Next when you are happy with the fit.', targets: ['#headPositionYGuideRow', '#headPositionZGuideRow', '#headUniformScaleGuideRow', '#viewport'] },
  { title: 'Rough scalp fit', text: 'Use Scale X, Y and Z to roughly match the scalp guide to the head. Orbit to check the fit, then press Next for point-level fine tuning.', targets: ['#headRoughScalpXGuideRow', '#headRoughScalpYGuideRow', '#headRoughScalpZGuideRow', '#viewport'] },
  { title: 'Fine tune the scalp', text: 'Click Fine Tune Scalp Guide. Use Select to pick points, then Move to adjust them with the gizmo. Transparent Head helps reach points through the mesh.\n\nFinish keeps your imported mesh and edits.', targets: ['#fineTuneScalpGuide', '#scalpBuilderPanel', '#viewport', '#viewportSelectTool', '#viewportMoveTool', '#proportionalToggle', '#proportionalPanel'] },
];
export function advanceImportHeadGuide(step, event) {
  if (event === 'back') return Math.max(0, step - 1);
  if (step === 0 && event === 'file-open') return 1;
  if (step === 1 && event === 'import-success') return 2;
  if (step >= 2 && step < importHeadGuideSteps.length - 1 && event === 'next') return step + 1;
  return step;
}
