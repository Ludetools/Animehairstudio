export function readStoredPreference(
  host,
  key,
  { fallback, normalize = (value) => value } = {}
) {
  try {
    const storedValue = host.localStorage.getItem(key);
    return storedValue === null ? fallback : normalize(storedValue);
  } catch {
    return fallback;
  }
}

export function readStoredBooleanPreference(host, key, fallback = false) {
  return readStoredPreference(host, key, {
    fallback: Boolean(fallback),
    normalize(value) {
      if (value === "true") return true;
      if (value === "false") return false;
      return Boolean(fallback);
    }
  });
}

export function writeStoredPreference(host, key, value) {
  try {
    host.localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}
