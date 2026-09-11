import { useLiveQuery } from "dexie-react-hooks";
import { useAppStore } from "./store";
import { canUseDb, getDb } from "./db";

export function useRows<T>(
  fn: () => Promise<T[]> | T[],
  deps: unknown[] = [],
): T[] {
  const ready = useAppStore((s) => s.ready);
  const data = useLiveQuery(() => {
    if (!ready || !canUseDb()) return [] as T[];
    return fn();
  }, [ready, ...deps]);
  return data ?? [];
}

export function useRow<T>(
  fn: () => Promise<T | undefined> | T | undefined,
  deps: unknown[] = [],
): T | undefined {
  const ready = useAppStore((s) => s.ready);
  return useLiveQuery(() => {
    if (!ready || !canUseDb()) return undefined;
    return fn();
  }, [ready, ...deps]);
}

export function useDbReady() {
  return useAppStore((s) => s.ready);
}

export { getDb };
