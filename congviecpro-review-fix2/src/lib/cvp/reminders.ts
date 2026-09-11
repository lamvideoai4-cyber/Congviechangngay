import { getDb, canUseDb } from "./db";
import { nid } from "./ids";
import { useAppStore } from "./store";

let lastTick = 0;

export async function tickReminders(): Promise<void> {
  if (!canUseDb()) return;
  const now = Date.now();
  if (now - lastTick < 30_000) return;
  lastTick = now;
  const db = getDb();
  const store = useAppStore.getState();
  if (!store.ready) return;

  const dueTasks = await db.tasks
    .filter((t) => t.status !== "COMPLETED" && t.deadline !== null && t.deadline < now + 30 * 60_000)
    .toArray();
  for (const t of dueTasks) {
    const exists = await db.notifications
      .filter((n) => n.recordId === t.id && n.module === "tasks" && now - n.createdAt < 2 * 3600_000)
      .first();
    if (exists) continue;
    const overdue = t.deadline !== null && t.deadline < now;
    await db.notifications.add({
      id: nid(),
      title: overdue ? "Công việc quá hạn" : "Công việc sắp đến hạn",
      body: t.name,
      module: "tasks",
      recordId: t.id,
      dueAt: t.deadline ?? now,
      read: false,
      createdAt: now,
    });
    notifyBrowser(overdue ? "Công việc quá hạn" : "Sắp đến hạn", t.name);
  }

  const missingData = await db.dataItems
    .filter((d) => d.status === "MISSING" || d.status === "NEW" || d.status === "PROCESSING")
    .toArray();
  for (const d of missingData) {
    const exists = await db.notifications
      .filter((n) => n.recordId === d.id && n.module === "dataItems" && now - n.createdAt < 4 * 3600_000)
      .first();
    if (exists) continue;
    await db.notifications.add({
      id: nid(),
      title: d.status === "MISSING" ? "DATA thiếu" : "DATA chưa hoàn thành",
      body: `${d.productCode} · ${d.invoice}`,
      module: "dataItems",
      recordId: d.id,
      dueAt: now,
      read: false,
      createdAt: now,
    });
  }

  const openLots = await db.lots.filter((l) => l.status !== "CLOSED").toArray();
  for (const lot of openLots) {
    const exists = await db.notifications
      .filter((n) => n.recordId === lot.id && n.module === "lots" && now - n.createdAt < 4 * 3600_000)
      .first();
    if (exists) continue;
    await db.notifications.add({
      id: nid(),
      title: "Lot chưa chốt",
      body: lot.lotCode,
      module: "lots",
      recordId: lot.id,
      dueAt: now,
      read: false,
      createdAt: now,
    });
  }
}

function notifyBrowser(title: string, body: string) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch {
      /* ignore */
    }
  }
}

export async function requestNotifyPermission() {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  const res = await Notification.requestPermission();
  return res === "granted";
}
