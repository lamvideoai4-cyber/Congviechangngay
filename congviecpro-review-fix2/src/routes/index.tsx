import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Package,
  ScanLine,
  Users,
} from "lucide-react";
import { useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { useAppStore } from "@/lib/cvp/store";
import { formatHours } from "@/lib/cvp/time";
import { Stat } from "@/components/cvp/page-header";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const date = useAppStore((s) => s.selectedDate);
  const shiftId = useAppStore((s) => s.selectedShiftId);

  const employees = useRows(() => getDb().employees.toArray());
  const attendance = useRows(
    () => getDb().attendance.filter((a) => a.date === date && (!shiftId || a.shiftId === shiftId)).toArray(),
    [date, shiftId],
  );
  const tasks = useRows(
    () => getDb().tasks.filter((t) => t.date === date && (!shiftId || t.shiftId === shiftId)).toArray(),
    [date, shiftId],
  );
  const goods = useRows(
    () => getDb().goodsItems.filter((g) => g.exportDate === date).toArray(),
    [date],
  );
  const dataItems = useRows(() => getDb().dataItems.toArray());
  const lots = useRows(
    () => getDb().lots.filter((l) => l.date === date).toArray(),
    [date],
  );
  const ots = useRows(
    () => getDb().overtimes.filter((o) => o.date === date).toArray(),
    [date],
  );
  const abs = useRows(
    () => getDb().abnormalities.filter((a) => a.status === "NEW" || a.status === "PROCESSING").toArray(),
  );

  const onShift = employees.filter((e) => !shiftId || e.shiftId === shiftId);
  const present = attendance.filter((a) => a.checkIn && a.status !== "ABSENT").length;
  const missingPeople = Math.max(0, onShift.filter((e) => e.status === "ACTIVE").length - present);
  const taskDone = tasks.filter((t) => t.status === "COMPLETED").length;
  const taskOpen = tasks.filter((t) => t.status !== "COMPLETED").length;
  const goodsOk = goods.filter((g) => g.status === "COMPLETED" || g.status === "ENOUGH").length;
  const goodsOpen = goods.length - goodsOk;
  const dataOk = dataItems.filter((d) => d.status === "COMPLETED" || d.status === "ENOUGH" || d.status === "PUSHED").length;
  const dataMissing = dataItems.filter((d) => d.status === "MISSING" || d.status === "NEW" || d.status === "PROCESSING").length;
  const lotsClosed = lots.filter((l) => l.status === "CLOSED").length;
  const lotsOpen = lots.filter((l) => l.status !== "CLOSED").length;
  const otMin = ots.reduce((s, o) => s + o.totalMinutes, 0);

  const cards = [
    {
      to: "/people",
      icon: Users,
      title: "Nhân sự",
      value: `${present} / ${onShift.filter((e) => e.status === "ACTIVE").length}`,
      ok: `Có mặt: ${present}`,
      bad: `Thiếu: ${missingPeople}`,
      tone: missingPeople > 0 ? "warn" : "ok",
    },
    {
      to: "/tasks",
      icon: ClipboardList,
      title: "Công việc",
      value: String(tasks.length),
      ok: `Hoàn thành: ${taskDone}`,
      bad: `Đang làm: ${taskOpen}`,
      tone: taskOpen > 0 ? "info" : "ok",
    },
    {
      to: "/goods",
      icon: Package,
      title: "Hàng xuất",
      value: String(goods.length),
      ok: `OK: ${goodsOk}`,
      bad: `Chưa xong: ${goodsOpen}`,
      tone: goodsOpen > 0 ? "warn" : "ok",
    },
    {
      to: "/goods",
      icon: FileSpreadsheet,
      title: "DATA",
      value: String(dataItems.length),
      ok: `OK: ${dataOk}`,
      bad: `Thiếu/chưa xong: ${dataMissing}`,
      tone: dataMissing > 0 ? "danger" : "ok",
    },
    {
      to: "/goods",
      icon: ScanLine,
      title: "Lot",
      value: String(lots.length),
      ok: `Đã chốt: ${lotsClosed}`,
      bad: `Chưa chốt: ${lotsOpen}`,
      tone: lotsOpen > 0 ? "warn" : "ok",
    },
    {
      to: "/ot",
      icon: Clock,
      title: "OT",
      value: `${formatHours(otMin)} giờ`,
      ok: `${ots.length} phiếu`,
      bad: "",
      tone: "info",
    },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ca hiện tại</h1>
          <p className="text-sm text-muted">Nhìn nhanh tình trạng, bấm thẻ để vào module.</p>
        </div>
        <Link
          to="/unfinished"
          className="inline-flex min-h-11 items-center rounded-full bg-danger/15 px-3 text-sm font-medium text-danger"
        >
          {abs.length + taskOpen + lotsOpen + dataMissing} cảnh báo
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.title}
              to={c.to}
              className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]"
            >
              <div className="mb-3 flex items-center justify-between text-muted">
                <Icon className="size-5" />
                <span className="text-xs font-medium uppercase tracking-wide">{c.title}</span>
              </div>
              <p className="font-mono text-2xl tabular-nums">{c.value}</p>
              <p className="mt-2 text-xs text-ok">{c.ok}</p>
              {c.bad ? <p className="text-xs text-warn">{c.bad}</p> : null}
            </Link>
          );
        })}
      </div>

      <Link
        to="/abnormal"
        className="flex items-center justify-between rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="size-5 text-danger" />
          <div>
            <p className="font-medium">Cảnh báo</p>
            <p className="text-sm text-muted">Bất thường chưa đóng</p>
          </div>
        </div>
        <span className="font-mono text-2xl tabular-nums text-danger">{abs.length}</span>
      </Link>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Quick to="/attendance" label="Chấm công" />
        <Quick to="/shift-log" label="Nhật ký ca" />
        <Quick to="/handover" label="Bàn giao" />
        <Quick to="/backup" label="Backup" />
      </div>

      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="mb-3 text-sm font-medium text-muted">Tóm tắt số</h2>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Việc" value={tasks.length} hint={`${taskDone} xong`} />
          <Stat label="OT giờ" value={formatHours(otMin)} />
          <Stat label="Cảnh báo" value={abs.length} tone={abs.length ? "danger" : "ok"} />
        </div>
      </section>
    </div>
  );
}

function Quick({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-14 items-center justify-center rounded-xl bg-surface-2 px-3 text-center text-sm font-medium shadow-[var(--shadow-border)]"
    >
      {label}
    </Link>
  );
}
