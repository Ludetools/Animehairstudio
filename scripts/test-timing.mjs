export function parseTestTimings(output) {
  const timings = [];
  let pendingTapName = null;
  String(output).split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.replace(/\u001b\[[0-9;]*m/g, "");
    const spec = line.match(/^\s*(?:✔|✖|﹣)\s+(.+?)\s+\(([\d.]+)ms\)$/u);
    if (spec) {
      timings.push({ name: spec[1], duration: Number(spec[2]) });
      pendingTapName = null;
      return;
    }
    const subtest = line.match(/^# Subtest: (.+)$/);
    if (subtest) {
      pendingTapName = subtest[1];
      return;
    }
    const duration = line.match(/^\s+duration_ms: ([\d.]+)$/);
    if (duration && pendingTapName) {
      timings.push({ name: pendingTapName, duration: Number(duration[1]) });
      pendingTapName = null;
    }
  });
  return timings;
}
