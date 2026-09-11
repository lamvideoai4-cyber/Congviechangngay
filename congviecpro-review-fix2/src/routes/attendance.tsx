import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader, Stat } from "@/components/cvp/page-header";
import { AttendanceBadge } from "@/components/cvp/status-badge";
import { FilterChip } from "@/components/cvp/filter-chip";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { useAppStore } from "@/lib/cvp/store";
import { checkOut, declareShift, markArrived, setLateMinutes } from "@/lib/cvp/repo";
import { can } from "@/lib/cvp/permissions";
import { formatDateVi, formatTime, addDays, parseDate } from "@/lib/cvp/time";
import { SHIFT_CATALOG, isLeaveCode } from "@/lib/cvp/shift-catalog";
import { downloadAttendanceExcel } from "@/lib/cvp/excel";

export const Route = createFileRoute("/attendance")({ component: AttendancePage });

type AttendanceTab = "roster" | "report";
type RosterMode = "week" | "month";

function rangeFor(anchor: string, mode: RosterMode) {
  const d = parseDate(anchor);
  if (mode === "month") {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const days: string[] = [];
    for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
      days.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`);
    }
    return days;
  }
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = addDays(anchor, mondayOffset);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function periodTitle(days: string[], mode: RosterMode) {
  if (!days.length) return "";
  if (mode === "month") {
    const d = parseDate(days[0]!);
    return `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
  }
  return `${formatDateVi(days[0]!)} – ${formatDateVi(days[days.length - 1]!)}`;
}

function AttendancePage() {
  const selectedDate = useAppStore((s) => s.selectedDate);
  const setDate = useAppStore((s) => s.setDate);
  const shiftId = useAppStore((s) => s.selectedShiftId);
  const role = useAppStore((s) => s.role);
  const people = useRows(() => getDb().employees.orderBy("code").toArray());
  const shifts = useRows(() => getDb().shifts.orderBy("order").toArray());
  const allAttendance = useRows(() => getDb().attendance.toArray());
  const ots = useRows(() => getDb().overtimes.toArray());
  const [tab, setTab] = useState<AttendanceTab>("roster");
  const [rosterMode, setRosterMode] = useState<RosterMode>("week");
  const [filter, setFilter] = useState<"all" | "work" | "leave" | "here">("all");

  const rosterDays = useMemo(() => rangeFor(selectedDate, rosterMode), [selectedDate, rosterMode]);
  const days = tab === "roster" ? rosterDays : [selectedDate];
  const byKey = useMemo(() => new Map(allAttendance.map((r) => [`${r.employeeId}|${r.date}`, r])), [allAttendance]);
  const byEmp = useMemo(() => new Map(allAttendance.filter((r) => r.date === selectedDate).map((r) => [r.employeeId, r])), [allAttendance, selectedDate]);
  const selected = shifts.find((s) => s.id === shiftId);

  const shownPeople = people.filter((p) => {
    if (tab === "roster") return true;
    const rec = byEmp.get(p.id);
    const code = rec?.declareCode || shifts.find((s) => s.id === p.shiftId)?.code || "";
    if (filter === "leave") return isLeaveCode(code) || rec?.status === "ABSENT";
    if (filter === "here") return Boolean(rec?.arrived);
    if (filter === "work") return !isLeaveCode(code) && rec?.status !== "ABSENT";
    return true;
  });

  const present = allAttendance.filter((r) => r.date === selectedDate && r.arrived).length;
  const late = allAttendance.filter((r) => r.date === selectedDate && (r.lateMinutes ?? 0) > 0 && r.arrived).length;
  const off = allAttendance.filter((r) => r.date === selectedDate && (r.status === "ABSENT" || isLeaveCode(r.declareCode))).length;

  const movePeriod = (delta: number) => {
    const d = parseDate(selectedDate);
    if (rosterMode === "month") d.setMonth(d.getMonth() + delta);
    else d.setDate(d.getDate() + delta * 7);
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  };

  const exportExcel = () => {
    const from = days[0]!;
    const to = days[days.length - 1]!;
    const inRange = (date: string) => date >= from && date <= to;
    const rows = people.flatMap((p) => {
      return days.map((date) => {
        const rec = byKey.get(`${p.id}|${date}`);
        const shift = rec ? shifts.find((s) => s.id === rec.shiftId) : shifts.find((s) => s.id === p.shiftId);
        const code = rec?.declareCode || shift?.code || "";
        const leave = isLeaveCode(code) || rec?.status === "ABSENT";
        const workedMinutes = rec?.checkIn && rec?.checkOut ? Math.max(0, Math.round((rec.checkOut - rec.checkIn) / 60000)) : 0;
        return {
          date,
          sbd: p.serialNumber || p.code,
          name: p.name,
          position: p.position,
          shift: leave ? code || "Nghỉ" : code,
          shiftTime: shift ? `${shift.startTime}–${shift.endTime}` : "",
          status: leave ? "Nghỉ" : rec?.status === "LATE" ? "Đến muộn" : rec?.arrived ? "Đã đến" : "Chưa khai",
          checkIn: rec?.checkIn ? formatTime(rec.checkIn) : "",
          checkOut: rec?.checkOut ? formatTime(rec.checkOut) : "",
          lateMinutes: rec?.lateMinutes ?? 0,
          otMinutes: rec?.otMinutes ?? 0,
          workHours: workedMinutes ? Math.round((workedMinutes / 60) * 100) / 100 : 0,
          note: rec?.note ?? "",
        };
      });
    });
    const otRows = ots.filter((o) => inRange(o.date)).map((o) => {
      const p = people.find((x) => x.id === o.employeeId);
      return { date: o.date, sbd: p?.serialNumber || p?.code || "", name: p?.name || "—", position: p?.position || "", startTime: o.startTime, endTime: o.endTime, totalHours: Math.round((o.totalMinutes / 60) * 100) / 100, type: o.type, note: o.note };
    });
    downloadAttendanceExcel(rows, otRows, periodTitle(days, rosterMode));
    toast.success("Đã xuất bảng công và OT Excel");
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Chấm công" subtitle={tab === "roster" ? "Khai ca cho toàn bộ nhân sự theo tuần / tháng" : `Chấm công · ${formatDateVi(selectedDate)}`} />

      <div className="grid grid-cols-2 gap-2">
        <Button variant={tab === "roster" ? "default" : "secondary"} onClick={() => setTab("roster")}>1. Khai ca</Button>
        <Button variant={tab === "report" ? "default" : "secondary"} onClick={() => setTab("report")}>2. Bảng công & OT</Button>
      </div>

      {tab === "roster" ? (
        <RosterTab
          people={people}
          shifts={shifts}
          days={rosterDays}
          mode={rosterMode}
          setMode={setRosterMode}
          selectedDate={selectedDate}
          onSelectDate={setDate}
          onMove={movePeriod}
          byKey={byKey}
          role={role}
        />
      ) : (
        <ReportTab
          people={shownPeople}
          shifts={shifts}
          byEmp={byEmp}
          selected={selected}
          role={role}
          filter={filter}
          setFilter={setFilter}
          present={present}
          late={late}
          off={off}
          onExport={exportExcel}
        />
      )}
    </div>
  );
}

function RosterTab({
  people, shifts, days, mode, setMode, selectedDate, onSelectDate, onMove, byKey, role,
}: {
  people: any[]; shifts: any[]; days: string[]; mode: RosterMode; setMode: (m: RosterMode) => void; selectedDate: string; onSelectDate: (d: string) => void; onMove: (n: number) => void; byKey: Map<string, any>; role: any;
}) {
  const workShifts = shifts.length ? shifts : SHIFT_CATALOG;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 overflow-x-auto">
        <Button size="sm" variant="secondary" onClick={() => onMove(-1)}>‹</Button>
        <Button size="sm" variant="secondary" onClick={() => onSelectDate(new Date().toISOString().slice(0, 10))}>Hôm nay</Button>
        <Button size="sm" variant="secondary" onClick={() => onMove(1)}>›</Button>
        {(["week", "month"] as RosterMode[]).map((m) => <FilterChip key={m} active={mode === m} onClick={() => setMode(m)}>{m === "week" ? "Tuần" : "Tháng"}</FilterChip>)}
        <span className="ml-auto whitespace-nowrap text-sm text-muted">{periodTitle(days, mode)}</span>
      </div>

      <div className="overflow-x-auto rounded-xl bg-surface shadow-[var(--shadow-border)]">
        <table className="min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="sticky left-0 z-20 min-w-52 bg-surface px-3 py-3">Nhân sự</th>
              {days.map((d) => <th key={d} className="min-w-32 px-2 py-3 text-center"><button className="font-medium" onClick={() => onSelectDate(d)}>{formatDateVi(d).slice(0, 5)}<span className="block text-xs font-normal text-muted">{new Date(`${d}T00:00:00`).toLocaleDateString("vi-VN", { weekday: "short" })}</span></button></th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {people.map((p) => {
              const defaultCode = shifts.find((s) => s.id === p.shiftId)?.code || "";
              return <tr key={p.id}>
                <td className="sticky left-0 z-10 bg-surface px-3 py-2">
                  <div className="font-medium">{p.name}</div>
                  <div className="font-mono text-xs text-muted">{p.serialNumber || p.code}{p.position ? ` · ${p.position}` : ""}</div>
                </td>
                {days.map((date) => {
                  const rec = byKey.get(`${p.id}|${date}`);
                  const value = rec?.declareCode || defaultCode;
                  return <td key={date} className="px-2 py-2 align-top">
                    <NativeSelect
                      className="h-11 min-w-28 text-xs"
                      value={value}
                      disabled={!can(role, "attendance")}
                      onChange={(e) => void declareShift(p.id, e.target.value, date).then(() => toast.success(`${p.name}: ${e.target.value || "đã xóa ca"}`)).catch((err) => toast.error(err instanceof Error ? err.message : "Lỗi"))}
                    >
                      {workShifts.map((s) => <option key={s.id || s.code} value={s.code}>{s.kind === "LEAVE" ? `${s.code} · ${s.name}` : `${s.code} ${s.startTime}–${s.endTime}`}</option>)}
                    </NativeSelect>
                    {value ? <div className={`mt-1 text-center text-[11px] ${isLeaveCode(value) ? "text-danger" : "text-muted"}`}>{isLeaveCode(value) ? (SHIFT_CATALOG.find((s) => s.code === value)?.label ?? "Nghỉ") : "Ca làm"}</div> : null}
                  </td>;
                })}
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Mỗi ô là một lần khai ca. Có thể chọn ca làm, ngày nghỉ, phép, ốm, nghĩa vụ…; dữ liệu được lưu theo từng nhân sự và từng ngày.</p>
    </section>
  );
}

function ReportTab({ people, shifts, byEmp, selected, role, filter, setFilter, present, late, off, onExport }: any) {
  return <>
    <div className="flex items-center justify-between gap-2">
      <div className="flex gap-2 overflow-x-auto">{([["all", "Tất cả"], ["work", "Đi làm"], ["here", "Đã đến"], ["leave", "Nghỉ"]] as const).map(([k, l]) => <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)}>{l}</FilterChip>)}</div>
      {can(role, "attendance") ? <Button size="sm" onClick={onExport}>Xuất Excel</Button> : null}
    </div>
    <div className="grid grid-cols-3 gap-2 rounded-xl bg-surface p-3 text-center shadow-[var(--shadow-border)]">
      <Stat label="Đã đến" value={present} />
      <Stat label="Muộn" value={late} />
      <Stat label="Nghỉ" value={off} />
    </div>
    <div className="rounded-xl bg-surface p-3 text-sm text-muted shadow-[var(--shadow-border)]">Ca đang chọn: <span className="text-fg">{selected?.code || "Tự do"}</span>. Nút <b className="text-fg">Xuất Excel</b> xuất toàn bộ nhân sự trong kỳ đang chọn ở mục Khai ca, gồm bảng công, tổng hợp và OT.</div>
    <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
      {people.map((p: any) => {
        const rec = byEmp.get(p.id);
        const defaultCode = shifts.find((s: any) => s.id === p.shiftId)?.code ?? "";
        const code = rec?.declareCode || defaultCode;
        const leave = isLeaveCode(code) || rec?.status === "ABSENT";
        return <li key={p.id} className="px-4 py-3">
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="font-medium">{p.name}</p><p className="font-mono text-xs text-muted">{p.serialNumber || p.code}{p.position ? ` · ${p.position}` : ""}{rec?.checkIn ? ` · ${formatTime(rec.checkIn)}` : ""}{rec?.arrived && (rec.lateMinutes ?? 0) > 0 ? ` · muộn ${rec.lateMinutes}p` : ""}</p></div>{rec ? <AttendanceBadge status={rec.status} /> : <span className="text-xs text-muted">Chưa khai</span>}</div>
          {can(role, "attendance") ? <div className="mt-2 space-y-2"><NativeSelect className="h-11" value={code} onChange={(e) => void declareShift(p.id, e.target.value).then(() => toast.success(`Khai ca ${e.target.value}`)).catch((err) => toast.error(err instanceof Error ? err.message : "Lỗi"))}>{SHIFT_CATALOG.map((s) => <option key={s.code} value={s.code}>{s.kind === "LEAVE" ? `${s.code} · ${s.label}` : `${s.code} ${s.startTime}–${s.endTime}`}</option>)}</NativeSelect>{leave ? <p className="text-sm text-muted">Ngày nghỉ / phép — không chấm đến.</p> : <div className="grid grid-cols-3 gap-2"><Button size="sm" variant={rec?.arrived ? "ok" : "secondary"} disabled={Boolean(rec?.arrived)} onClick={async () => { try { const row = await markArrived(p.id); toast.success(row.lateMinutes > 0 ? `Đã đến, muộn ${row.lateMinutes} phút` : `Đã đến đúng giờ: ${p.name}`); } catch (e) { toast.error(e instanceof Error ? e.message : "Lỗi"); } }}>Đã đến</Button><Button size="sm" variant="secondary" disabled={!rec?.checkIn || Boolean(rec?.checkOut)} onClick={async () => { try { await checkOut(p.id); toast.success(`Đã chấm ra: ${p.name}`); } catch (e) { toast.error(e instanceof Error ? e.message : "Lỗi"); } }}>Ra</Button><label className="flex h-10 min-h-10 items-center gap-1 rounded-md bg-surface-2 px-2 text-xs shadow-[var(--shadow-border)]"><span className="text-muted">Muộn</span><Input type="number" min={0} className="h-8 w-14 bg-transparent px-1" value={rec?.lateMinutes ?? 0} disabled={!rec?.arrived} onChange={(e) => void setLateMinutes(p.id, Number(e.target.value))}/><span className="text-muted">p</span></label></div>}</div> : null}
        </li>;
      })}
    </ul>
  </>;
}
