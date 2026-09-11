import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, Stat } from "@/components/cvp/page-header";
import { FilterChip } from "@/components/cvp/filter-chip";
import { useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { addDays, formatHours, startOfMonth, startOfWeek } from "@/lib/cvp/time";
import { useAppStore } from "@/lib/cvp/store";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

function ReportsPage() {
  const date = useAppStore((s) => s.selectedDate);
  const [range, setRange] = useState<"day" | "week" | "month">("day");
  const from = range === "day" ? date : range === "week" ? startOfWeek(date) : startOfMonth(date);
  const to = date;

  const tasks = useRows(() => getDb().tasks.toArray());
  const dataItems = useRows(() => getDb().dataItems.toArray());
  const lots = useRows(() => getDb().lots.toArray());
  const goods = useRows(() => getDb().goodsItems.toArray());
  const ots = useRows(() => getDb().overtimes.toArray());
  const amhs = useRows(() => getDb().amhs.toArray());
  const people = useRows(() => getDb().employees.toArray());
  const abs = useRows(() => getDb().abnormalities.toArray());

  const inRange = (d: string) => d >= from && d <= to;
  const t = tasks.filter((x) => inRange(x.date));
  const o = ots.filter((x) => inRange(x.date));
  const l = lots.filter((x) => inRange(x.date));
  const g = goods.filter((x) => inRange(x.exportDate));

  const chart = useMemo(() => {
    const days: { name: string; xong: number; dang: number }[] = [];
    let cur = from;
    while (cur <= to) {
      const dayTasks = tasks.filter((x) => x.date === cur);
      days.push({
        name: cur.slice(8),
        xong: dayTasks.filter((x) => x.status === "COMPLETED").length,
        dang: dayTasks.filter((x) => x.status !== "COMPLETED").length,
      });
      cur = addDays(cur, 1);
      if (days.length > 31) break;
    }
    return days;
  }, [from, to, tasks]);

  return (
    <div className="space-y-4">
      <PageHeader title="Báo cáo" subtitle={`${from} → ${to}`} />
      <div className="flex gap-2">
        {(["day", "week", "month"] as const).map((r) => (
          <FilterChip key={r} active={range === r} onClick={() => setRange(r)}>
            {r === "day" ? "Ngày" : r === "week" ? "Tuần" : "Tháng"}
          </FilterChip>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <Stat label="Công việc" value={t.length} hint={`Xong ${t.filter((x) => x.status === "COMPLETED").length}`} />
        <Stat label="Quá hạn" value={t.filter((x) => x.status === "OVERDUE").length} tone="danger" />
        <Stat label="DATA" value={dataItems.length} hint={`Thiếu ${dataItems.filter((d) => d.status === "MISSING").length}`} />
        <Stat label="Lot đã chốt" value={l.filter((x) => x.status === "CLOSED").length} hint={`${l.length} lot`} />
        <Stat label="Hàng xuất" value={g.length} />
        <Stat label="OT" value={`${formatHours(o.reduce((s, x) => s + x.totalMinutes, 0))}h`} />
        <Stat label="AMH" value={amhs.length} />
        <Stat label="Nhân sự" value={people.filter((p) => p.status === "ACTIVE").length} />
        <Stat label="Bất thường" value={abs.filter((a) => a.status !== "CLOSED").length} tone="warn" />
      </div>
      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="mb-3 text-sm font-medium text-muted">Công việc theo ngày</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid stroke="rgba(236,236,232,0.08)" vertical={false} />
              <XAxis dataKey="name" stroke="#8b8e96" fontSize={11} />
              <YAxis stroke="#8b8e96" fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#16181c", border: "1px solid #2a2d33", borderRadius: 8 }}
              />
              <Bar dataKey="xong" fill="#6f9e7a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="dang" fill="#6e8fad" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
