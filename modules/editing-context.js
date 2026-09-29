export function editingContextLabel({ workspace, selectionMode, meshMode, transformSpace, mirror, posePreview = false }) {
  if (workspace === 'rigging') return `Rigging · ${posePreview ? 'Pose preview' : 'Rest bones'} · ${transformSpace === 'object' ? 'Object' : 'World'} axes`;
  const workspaces = { strand: 'Strands', mesh: 'Meshes', guide: 'Guides', reference: 'References' };
  const modes = { vert: 'Vertices', edge: 'Edges', face: 'Faces', curve: 'Curves', object: 'Object' };
  const mode = workspace === 'mesh' ? modes[meshMode] || meshMode
    : workspace === 'reference' ? 'Object' : selectionMode === 'object' ? 'Object' : 'Component';
  const space = { world: 'World', object: 'Object', normal: 'Normal' }[transformSpace] || 'World';
  return `${workspaces[workspace] || workspace} / ${mode} · ${space} axes${mirror && (workspace === 'strand' || workspace === 'mesh') ? ' · X mirror on' : ''}`;
}

export function meshOperationReasons(edgeCount, topologyAllowed, allBoundary) {
  const base = 'Requires a base mesh without procedural extrusions.';
  return {
    bevel: !edgeCount ? 'Select one or more edges to bevel.' : !topologyAllowed ? base : '',
    bridge: !topologyAllowed ? base : edgeCount !== 2 ? 'Select exactly two separate boundary edges to bridge.' : !allBoundary ? 'Both selected edges must be open boundary edges.' : '',
    flow: !edgeCount ? 'Select one or more edges to adjust their flow.' : '',
  };
}

// Single-target workspaces must not drop their selection on an empty additive drag.
export function singleTargetMarqueeSelection(current, matches, mode) {
  if (mode === 'remove') return matches.includes(current) ? null : current;
  if (mode === 'add') return current || matches[0] || null;
  return matches[0] || null;
}
