export function applicationDropFileKind(file) {
  const name = String(file?.name || file || "").trim();
  if (/\.ahs$/i.test(name)) return "project";
  if (/\.obj$/i.test(name)) return "obj";
  return null;
}
