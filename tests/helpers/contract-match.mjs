export function contractPatternMatches(actual, pattern) {
  const source = pattern.source;
  const requiresNativeRegex = /(^|[^\\])\|/.test(source)
    || /\\[1-9]/.test(source)
    || source.includes("(?");
  if (!(pattern instanceof RegExp) || !source.includes("[\\s\\S]*") || requiresNativeRegex) {
    return pattern.test(actual);
  }
  const flags = pattern.flags.replace(/[gy]/g, "");
  const parts = source.split(/\[\\s\\S\]\*\??/);
  let offset = 0;
  for (const part of parts) {
    if (!part) continue;
    const match = new RegExp(part, flags).exec(actual.slice(offset));
    if (!match) return false;
    offset += match.index + match[0].length;
  }
  return true;
}
