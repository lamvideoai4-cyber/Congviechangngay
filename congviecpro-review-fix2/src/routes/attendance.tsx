import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/cvp/page-header";
import { AttendanceBadge } from "@/components/cvp/status-badge";
import { FilterChip } from "@/components/cvp/filter-chip";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { useAppStore } from "@/lib/cvp/store";
import { checkOut, declareShift, markArrived, setLateMinutes } from "@/lib/cvp/repo";
import { can } from "@/lib/cvp/permissions";
import { formatTime } from "@/lib/cvp/time";
import { SHIFT_CATALOG, isLeaveCode, shiftLabel } from "@/lib/cvp/shift-catalog";

export const Route = createFileRoute("/attendance")({ component: AttendancePage });

function AttendancePage() {
  const date = useAppStore((s) => s.selectedDate);
  const shiftId = useAppStore((s) => s.selectedShiftId);
  const role = useAppStore((s) => s.role);
  const people = useRows(() => getDb().employees.orderBy("code").toArray());
  const shifts = useRows(() => getDb().shifts.orderBy("order").toArray());
  const rows = useRows(() => getDb().attendance.filter((a) => a.date === date).toArray(), [date]);
  const [filter, setFilter] = useState<"all" | "work" | "leave" | "here">("all");
  const byEmp = new Map(rows.map((r) => [r.employeeId, r]));
  const selected = shifts.find((s) => s.id === shiftId);

  const list = useMemo(() => {
    return people.filter((p) => p.status === "ACTIVE" || byEmp.has(p.id));
  }, [people, byEmp]);

  const shown = list.filter((p) => {
    const rec = byEmp.get(p.id);
    const code = rec?.declareCode || shifts.find((s) => s.id === p.shiftId)?.code || "";
    if (filter === "leave") return isLeaveCode(code) || rec?.status === "ABSENT";
    if (filter === "here") return Boolean(rec?.arrived);
    if (filter === "work") return !isLeaveCode(code) && rec?.status !== "ABSENT";
    return true;
  });

  const present = rows.filter((r) => r.arrived).length;
  const late = rows.filter((r) => (r.lateMinutes ?? 0) > 0 && r.arrived).length;
  const off = rows.filter((r) => r.status === "ABSENT" || isLeaveCode(r.declareCode)).length;

  return (
    <div>
      <PageHeader
        title="Chấm công"
        subtitle={`Tích đã đến · phút muộn so với giờ ca${selected?.code ? ` ${selected.code}` : ""}`}
      />
      <div className="mb-3 grid grid-cols-3 gap-2 rounded-xl bg-surface p-3 text-center shadow-[var(--shadow-border)]">
        <div>
          <p className="text-xs text-muted">Đã đến</p>
          <p className="font-mono text-xl tabular-nums">{present}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Muộn</p>
          <p className="font-mono text-xl tabular-nums text-warn">{late}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Nghỉ</p>
          <p className="font-mono text-xl tabular-nums text-danger">{off}</p>
        </div>
      </div>
      <div className="mb-3 flex gap-2 overflow-x-auto">
        {(
          [
            ["all", "Tất cả"],
            ["work", "Đi làm"],
            ["here", "Đã đến"],
            ["leave", "Nghỉ"],
          ] as const
        ).map(([k, l]) => (
          <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)}>
            {l}
          </FilterChip>
        ))}
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
        {shown.map((p) => {
          const rec = byEmp.get(p.id);
          const defaultCode = shifts.find((s) => s.id === p.shiftId)?.code ?? "";
          const code = rec?.declareCode || defaultCode;
          const leave = isLeaveCode(code) || rec?.status === "ABSENT";
          return (
            <li key={p.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{p.name}</p>
                  <p className="font-mono text-xs text-muted">
                    {p.serialNumber || p.code}
                    {p.position ? ` · ${p.position}` : ""}
                    {rec?.checkIn ? ` · ${formatTime(rec.checkIn)}` : ""}
                    {rec?.arrived && (rec.lateMinutes ?? 0) > 0 ? ` · muộn ${rec.lateMinutes}p` : ""}
                  </p>
                </div>
                {rec ? <AttendanceBadge status={rec.status} /> : <span className="text-xs text-muted">Chưa khai</span>}
              </div>
              {can(role, "attendance") ? (
                <div className="mt-2 space-y-2">
                  <NativeSelect
                    className="h-11"
                    value={code}
                    onChange={(e) => {
                      void declareShift(p.id, e.target.value)
                        .then(() => toast.success(`Khai ca ${e.target.value}`))
                        .catch((err) => toast.error(err instanceof Error ? err.message : "Lỗi"));
                    }}
                  >
                    {SHIFT_CATALOG.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.kind === "LEAVE"
                          ? `${s.code} · ${s.label}`
                          : `${s.code} ${s.startTime}–${s.endTime}`}
                      </option>
                    ))}
                  </NativeSelect>
                  {leave ? (
                    <p className="text-sm text-muted">Ngày nghỉ / phép — không chấm đến. AMH 0 giờ ca.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        size="sm"
                        variant={rec?.arrived ? "ok" : "secondary"}
                        disabled={Boolean(rec?.arrived)}
                        onClick={async () => {
                          try {
                            const row = await markArrived(p.id);
                            toast.success(
                              row.lateMinutes > 0
                                ? `Đã đến, muộn ${row.lateMinutes} phút`
                                : `Đã đến đúng giờ: ${p.name}`,
                            );
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Lỗi");
                          }
                        }}
                      >
                        Đã đến
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!rec?.checkIn || Boolean(rec?.checkOut)}
                        onClick={async () => {
                          try {
                            await checkOut(p.id);
                            toast.success(`Đã chấm ra: ${p.name}`);
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Lỗi");
                          }
                        }}
                      >
                        Ra
                      </Button>
                      <label className="flex h-10 min-h-10 items-center gap-1 rounded-md bg-surface-2 px-2 text-xs shadow-[var(--shadow-border)]">
                        <span className="text-muted">Muộn</span>
                        <input
                          type="number"
                          min={0}
                          className="h-8 w-14 bg-transparent font-mono text-sm"
                          value={rec?.lateMinutes ?? 0}
                          disabled={!rec?.arrived}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (!Number.isFinite(n)) return;
                            void setLateMinutes(p.id, n);
                          }}
                        />
                        <span className="text-muted">p</span>
                      </label>
                    </div>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {shown.length === 0 ? <p className="mt-4 text-sm text-muted">Không có nhân sự.</p> : null}
    </div>
  );
}
