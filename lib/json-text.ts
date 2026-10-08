/** JSON payloads stored in MySQL LONGTEXT, decoded at the application boundary. */
export function readJsonText(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) as unknown } catch { return null }
}

export function readJsonObject(value: unknown): Record<string, unknown> {
  const parsed = readJsonText(value)
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {}
}

export function writeJsonText(value: unknown): string {
  // Already encoded payloads retain their bytes; avoid double encoding.
  return typeof value === 'string' ? value : JSON.stringify(value ?? {})
}
