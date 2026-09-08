// One authored-state checkpoint per continuous control edit. DOM event routing
// and scene restoration remain with the application coordinator.
export function createInputEditSession({ capture, restore }) {
  let active = null;
  return {
    begin(owner) {
      if (active?.owner === owner) return;
      active = null;
      const checkpoint = capture();
      if (checkpoint) active = { owner, checkpoint };
    },
    finish(owner) {
      if (!owner || active?.owner === owner) active = null;
    },
    cancel(owner) {
      if (!active || (owner && active.owner !== owner)) return null;
      const edit = active;
      active = null;
      restore(edit.checkpoint);
      return edit.owner;
    }
  };
}
