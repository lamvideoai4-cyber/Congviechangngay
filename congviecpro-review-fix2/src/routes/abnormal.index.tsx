import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/cvp/page-header";
import { AbnormalBadge } from "@/components/cvp/status-badge";
import { AbnormalDialog } from "@/components/cvp/abnormal-dialog";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/cvp/filter-chip";
import { useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { SEVERITY_LABEL, type AbnormalStatus } from "@/lib/cvp/types";

export const Route = createFileRoute("/abnormal/")({ component: AbnormalPage });

function AbnormalPage() {
  const rows = useRows(() => getDb().abnormalities.reverse().sortBy("detectedAt"));
  const people = useRows(() => getDb().employees.toArray());
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | AbnormalStatus>("all");
  const shown = rows.filter((r) => filter === "all" || r.status === filter);

  return (
    <div>
      <PageHeader
        title="Bất thường"
        subtitle="Ghi nhận từ mọi module"
        action={
          <Button size="sm" onClick={() => setOpen(true)}>
            Báo cáo
          </Button>
        }
      />
      <div className="mb-3 flex gap-2 overflow-x-auto">
        {(["all", "NEW", "PROCESSING", "RESOLVED", "CLOSED"] as const).map((f) => (
          <FilterChip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f === "all" ? "Tất cả" : f === "NEW" ? "Mới" : f === "PROCESSING" ? "Đang xử lý" : f === "RESOLVED" ? "Đã xử lý" : "Đóng"}
          </FilterChip>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState title="Không có bất thường" />
      ) : (
        <ul className="space-y-2">
          {shown.map((a) => {
            const who = people.find((p) => p.id === a.detectedBy);
            return (
              <li key={a.id}>
                <Link
                  to="/abnormal/$id"
                  params={{ id: a.id }}
                  className="block rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{a.type}</p>
                      <p className="line-clamp-2 text-sm text-muted">{a.description}</p>
                      <p className="mt-1 text-xs text-muted">
                        {who?.name} · {SEVERITY_LABEL[a.severity]}
                      </p>
                    </div>
                    <AbnormalBadge status={a.status} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <AbnormalDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
