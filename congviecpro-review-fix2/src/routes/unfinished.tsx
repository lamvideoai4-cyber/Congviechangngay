import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/cvp/page-header";
import { DataBadge, GoodsBadge, LotBadge, TaskBadge, AbnormalBadge } from "@/components/cvp/status-badge";
import { useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { useAppStore } from "@/lib/cvp/store";

export const Route = createFileRoute("/unfinished")({ component: UnfinishedPage });

function UnfinishedPage() {
  const date = useAppStore((s) => s.selectedDate);
  const dataMissing = useRows(() =>
    getDb().dataItems.filter((d) => d.status === "MISSING" || d.status === "NEW" || d.status === "PROCESSING").toArray(),
  );
  const goodsOpen = useRows(() =>
    getDb().goodsItems.filter((g) => g.status !== "COMPLETED" && g.status !== "ENOUGH").toArray(),
  );
  const lotsOpen = useRows(() => getDb().lots.filter((l) => l.status !== "CLOSED").toArray());
  const tasks = useRows(
    () => getDb().tasks.filter((t) => t.date === date && t.status !== "COMPLETED").toArray(),
    [date],
  );
  const threeS = useRows(
    () => getDb().threeS.filter((t) => t.date === date && !t.completedAt).toArray(),
    [date],
  );
  const abs = useRows(() =>
    getDb().abnormalities.filter((a) => a.status === "NEW" || a.status === "PROCESSING").toArray(),
  );
  const total = dataMissing.length + goodsOpen.length + lotsOpen.length + tasks.length + threeS.length + abs.length;

  return (
    <div>
      <PageHeader title="Việc chưa xong" subtitle={`${total} mục cần xử lý trong ca`} />
      {total === 0 ? (
        <EmptyState title="Ca đang sạch" hint="Không còn DATA thiếu, lot chưa chốt hay việc quá hạn." />
      ) : (
        <div className="space-y-6">
          <Section title="DATA thiếu / chưa xong">
            {dataMissing.map((d) => (
              <Link key={d.id} to="/goods/data/$id" params={{ id: d.id }} className="row">
                <div>
                  <p className="font-medium">{d.productCode}</p>
                  <p className="text-xs text-muted">{d.invoice} · {d.lot}</p>
                </div>
                <DataBadge status={d.status} />
              </Link>
            ))}
            {dataMissing.length === 0 ? <p className="text-sm text-muted">Không có</p> : null}
          </Section>
          <Section title="Hàng chưa hoàn thành">
            {goodsOpen.map((g) => (
              <Link key={g.id} to="/goods/export/$id" params={{ id: g.id }} className="row">
                <div>
                  <p className="font-medium">{g.productCode}</p>
                  <p className="text-xs text-muted">{g.invoice}</p>
                </div>
                <GoodsBadge status={g.status} />
              </Link>
            ))}
            {goodsOpen.length === 0 ? <p className="text-sm text-muted">Không có</p> : null}
          </Section>
          <Section title="Lot chưa chốt">
            {lotsOpen.map((l) => (
              <Link key={l.id} to="/goods/lot/$id" params={{ id: l.id }} className="row">
                <div>
                  <p className="font-medium">{l.lotCode}</p>
                  <p className="text-xs text-muted">{l.invoice}</p>
                </div>
                <LotBadge status={l.status} />
              </Link>
            ))}
            {lotsOpen.length === 0 ? <p className="text-sm text-muted">Không có</p> : null}
          </Section>
          <Section title="Công việc chưa xong / quá hạn">
            {tasks.map((t) => (
              <Link key={t.id} to="/tasks/$id" params={{ id: t.id }} className="row">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted">{t.progress}%</p>
                </div>
                <TaskBadge status={t.status} />
              </Link>
            ))}
            {tasks.length === 0 ? <p className="text-sm text-muted">Không có</p> : null}
          </Section>
          <Section title="3S chưa hoàn thành">
            {threeS.map((t) => (
              <Link key={t.id} to="/threes" className="row">
                <p className="font-medium">Checklist 3S {t.date}</p>
              </Link>
            ))}
            {threeS.length === 0 ? <p className="text-sm text-muted">Không có</p> : null}
          </Section>
          <Section title="Bất thường chưa xử lý">
            {abs.map((a) => (
              <Link key={a.id} to="/abnormal/$id" params={{ id: a.id }} className="row">
                <div>
                  <p className="font-medium">{a.type}</p>
                  <p className="line-clamp-1 text-xs text-muted">{a.description}</p>
                </div>
                <AbnormalBadge status={a.status} />
              </Link>
            ))}
            {abs.length === 0 ? <p className="text-sm text-muted">Không có</p> : null}
          </Section>
        </div>
      )}
      <style>{`.row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:56px;padding:12px 0;border-bottom:1px solid var(--color-border)}`}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{title}</h2>
      <div className="rounded-xl bg-surface px-4 shadow-[var(--shadow-border)]">{children}</div>
    </section>
  );
}
