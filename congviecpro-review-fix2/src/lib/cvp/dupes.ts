export function detectDuplicates<T extends { id: string }>(incoming: T[], existing: T[]): T[] {
  const ids = new Set(existing.map((e) => e.id));
  return incoming.filter((row) => ids.has(row.id));
}
