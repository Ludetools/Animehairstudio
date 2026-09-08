const tips = {
  select: ['Pick a strand to see its settings. Component mode edits its curve; Object mode transforms the whole strand.', 'The outliner eye hides an item without deleting it. Useful when a hairstyle gets crowded!'],
  draw: ['Draw a stroke on the live surface to create a strand. Width and depth shape its cross-section.', 'Try a few broad strands first, then add smaller strands for detail.'],
  move: ['Drag a gizmo axis to move along it. World uses the scene axes; Object uses the object’s orientation.'],
  rotate: ['World and Object transform spaces change which axes the rotation gizmo follows.'],
  scale: ['Scale changes the selected shape. For strand thickness, use Width and Depth in the settings.'],
  relax: ['Relax helps soften uneven curve points. Work gently to preserve the silhouette.'],
  'loop-cut': ['Point at a quad to preview a loop cut. Hold Shift for a halfway cut; left-click to confirm.'],
  'standard-extrude': ['Select a mesh face, then drag to extrude it along its normal.'],
  'face-extrude': ['Select a mesh face and draw a curve to guide its extrusion.'],
  'sculpt-move': ['Move Brush nudges nearby strand points with a soft influence.'],
  'sculpt-smooth': ['Smooth Brush softens nearby strand curves. Small strokes help preserve the hairstyle.'],
  'sculpt-inflate': ['Inflate Brush adjusts strand width and depth profiles under the brush.'],
};
export const CURVY_PREFERENCE_KEY = 'anime-hair-studio-curvy';
export function curvyTips(tool, label = 'this tool') {
  return tips[tool] || [`You’re using ${label}. Its contextual settings explain the available controls.`, 'Build the silhouette first. Check the hairstyle from the side and back as you add detail.'];
}
export function mountCurvy(root) {
  const bubble = root.querySelector('[data-curvy-bubble]');
  const text = root.querySelector('[data-curvy-tip]');
  const topic = root.querySelector('[data-curvy-topic]');
  const toggle = root.querySelector('[data-curvy-toggle]');
  let current = '', index = 0, entries = curvyTips('select'), label = '', enabled = false;
  root.hidden = true;
  const render = () => { text.textContent = entries[index]; topic.textContent = label; };
  const open = value => { bubble.hidden = !value; toggle.setAttribute('aria-expanded', String(value)); };
  toggle.addEventListener('click', () => open(bubble.hidden));
  root.querySelector('[data-curvy-close]').addEventListener('click', () => { open(false); toggle.focus(); });
  root.querySelector('[data-curvy-next]').addEventListener('click', () => { index = (index + 1) % entries.length; render(); });
  for (const event of ['pointerdown', 'pointerup', 'click', 'dblclick', 'wheel', 'contextmenu']) root.addEventListener(event, e => e.stopPropagation());
  return {
    get enabled() { return enabled; },
    setEnabled(value) { enabled = value === true; root.hidden = !enabled; },
    update(tool, nextLabel) {
      if (!enabled || (current === tool && label === nextLabel)) return;
      current = tool; label = nextLabel; index = 0; entries = curvyTips(tool, label); render();
    },
  };
}
