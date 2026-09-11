import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/cvp/page-header";
import { Input } from "@/components/ui/input";
import { useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";

export const Route = createFileRoute("/search")({ component: SearchPage });

function SearchPage() {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const people = useRows(() => getDb().employees.toArray());
  const tasks = useRows(() => getDb().tasks.toArray());
  const data = useRows(() => getDb().dataItems.toArray());
  const goods = useRows(() => getDb().goodsItems.toArray());
  const lots = useRows(() => getDb().lots.toArray());

  const peopleHits = needle
    ? people.filter((p) => p.name.toLowerCase().includes(needle) || p.code.toLowerCase().includes(needle))
    : [];
  const taskHits = needle ? tasks.filter((t) => t.name.toLowerCase().includes(needle)) : [];
  const dataHits = needle
    ? data.filter(
        (d) =>
          d.productCode.toLowerCase().includes(needle) ||
          d.invoice.toLowerCase().includes(needle) ||
          d.lot.toLowerCase().includes(needle),
      )
    : [];
  const goodsHits = needle
    ? goods.filter(
        (d) =>
          d.productCode.toLowerCase().includes(needle) ||
          d.invoice.toLowerCase().includes(needle) ||
          d.lot.toLowerCase().includes(needle),
      )
    : [];
  const lotHits = needle
    ? lots.filter((d) => d.lotCode.toLowerCase().includes(needle) || d.invoice.toLowerCase().includes(needle))
    : [];
  const total = peopleHits.length + taskHits.length + dataHits.length + goodsHits.length + lotHits.length;

  return (
    <div>
      <PageHeader title="Tìm kiếm" subtitle="Tên, mã NV, mã SP, invoice, lot, công việc" />
      <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Gõ để lọc…" className="mb-4" />
      {!needle ? (
        <EmptyState title="Nhập từ khóa" hint="Tìm nhanh trên toàn bộ dữ liệu đang lưu trên máy." />
      ) : total === 0 ? (
        <EmptyState title="Không có kết quả" />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
          {peopleHits.map((p) => (
            <li key={p.id}>
              <Link to="/people/$id" params={{ id: p.id }} className="flex min-h-14 items-center justify-between px-4">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="font-mono text-xs text-muted">{p.code}</p>
                </div>
                <span className="text-xs text-muted">Nhân sự</span>
              </Link>
            </li>
          ))}
          {taskHits.map((t) => (
            <li key={t.id}>
              <Link to="/tasks/$id" params={{ id: t.id }} className="flex min-h-14 items-center justify-between px-4">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="font-mono text-xs text-muted">{t.status}</p>
                </div>
                <span className="text-xs text-muted">Việc</span>
              </Link>
            </li>
          ))}
          {dataHits.map((d) => (
            <li key={d.id}>
              <Link to="/goods/data/$id" params={{ id: d.id }} className="flex min-h-14 items-center justify-between px-4">
                <div>
                  <p className="font-medium">{d.productCode}</p>
                  <p className="font-mono text-xs text-muted">{d.invoice}</p>
                </div>
                <span className="text-xs text-muted">DATA</span>
              </Link>
            </li>
          ))}
          {goodsHits.map((d) => (
            <li key={d.id}>
              <Link to="/goods/export/$id" params={{ id: d.id }} className="flex min-h-14 items-center justify-between px-4">
                <div>
                  <p className="font-medium">{d.productCode}</p>
                  <p className="font-mono text-xs text-muted">{d.invoice}</p>
                </div>
                <span className="text-xs text-muted">Hàng</span>
              </Link>
            </li>
          ))}
          {lotHits.map((d) => (
            <li key={d.id}>
              <Link to="/goods/lot/$id" params={{ id: d.id }} className="flex min-h-14 items-center justify-between px-4">
                <div>
                  <p className="font-medium">{d.lotCode}</p>
                  <p className="font-mono text-xs text-muted">{d.invoice}</p>
                </div>
                <span className="text-xs text-muted">Lot</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
