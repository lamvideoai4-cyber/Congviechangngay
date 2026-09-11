import { canUseDb, getDb } from "./db";
import { clearSampleData, seedCatalog, seedSampleData } from "./seed";
import { persistSetting, refreshOverdueTasks } from "./repo";
import { useAppStore } from "./store";
import { formatDate, getActiveContext } from "./time";
import type { Role } from "./types";
import { tickReminders } from "./reminders";
import { ensureShiftCatalog } from "./shift-catalog";

let started = false;

export async function initApp(): Promise<void> {
  if (!canUseDb()) {
    useAppStore.getState().setReady(true);
    return;
  }
  const db = getDb();
  await db.open();
  const initialized = await db.settings.get("initialized");
  if (!initialized) {
    await seedCatalog(db);
    await seedSampleData(db);
    await db.settings.put({ key: "initialized", value: "true" });
    await db.settings.put({ key: "otRoundMinutes", value: "30" });
  } else {
    await ensureShiftCatalog(db);
  }
  const sample = (await db.settings.get("sampleData"))?.value === "true";
  const userId = (await db.settings.get("currentUserId"))?.value ?? null;
  const user = userId ? await db.employees.get(userId) : null;
  const otRound = Number((await db.settings.get("otRoundMinutes"))?.value ?? 30);
  const autoShift = (await db.settings.get("autoShift"))?.value !== "false";
  const savedShift = (await db.settings.get("selectedShiftId"))?.value ?? null;
  const savedDate = (await db.settings.get("selectedDate"))?.value ?? formatDate(new Date());
  const shifts = await db.shifts.orderBy("order").toArray();
  const now = new Date();
  const active = getActiveContext(now, shifts);
  const shiftId = autoShift ? (active?.shift.id ?? savedShift ?? shifts[0]?.id ?? null) : savedShift;
  const date = autoShift && active ? active.date : savedDate;

  useAppStore.getState().hydrate({
    currentUserId: user?.id ?? null,
    currentUserName: user?.name ?? "Hệ thống",
    role: (user?.role as Role) ?? "ADMIN",
    selectedDate: date,
    selectedShiftId: shiftId,
    autoShift,
    otRoundMinutes: Number.isFinite(otRound) ? otRound : 30,
    sampleData: sample,
  });
  await refreshOverdueTasks();
  useAppStore.getState().setReady(true);
  if (!started) {
    started = true;
    window.setInterval(() => {
      void tickReminders();
    }, 60_000);
    void tickReminders();
  }
}

export async function applyCurrentUser(id: string | null) {
  const db = getDb();
  const user = id ? await db.employees.get(id) : null;
  useAppStore.getState().setUser(user?.id ?? null, user?.name ?? "Hệ thống", user?.role ?? "ADMIN");
  await persistSetting("currentUserId", user?.id ?? "");
}

export async function applyShift(id: string | null, auto: boolean) {
  useAppStore.getState().setShift(id, auto);
  await persistSetting("selectedShiftId", id ?? "");
  await persistSetting("autoShift", auto ? "true" : "false");
}

export async function applyDate(date: string) {
  useAppStore.getState().setDate(date);
  await persistSetting("selectedDate", date);
}

export async function wipeSample() {
  await clearSampleData(getDb());
  useAppStore.getState().setSampleData(false);
}
