import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/cvp/page-header";
import { DataBadge } from "@/components/cvp/status-badge";
import { PhotoStrip } from "@/components/cvp/photo-strip";
import { Button } from "@/components/ui/button";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { useRow } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { deleteDataItem, upsertDataItem } from "@/lib/cvp/repo";
import { DATA_STATUS_LABEL, type DataStatus } from "@/lib/cvp/types";
import { missingDataMail } from "@/lib/cvp/mail";
import { formatDateTime } from "@/lib/cvp/time";

export const Route = createFileRoute("/goods/data/$id")({ component: DataDetail });

function DataDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const item = useRow(() => getDb().dataItems.get(id), [id]);
  if (!item) return <p className="text-muted">Không tìm thấy DATA.</p>;

  return (
    <div className="space-y-4">
      <PageHeader title={item.productCode} subtitle={item.invoice} back="/goods" action={<DataBadge status={item.status} />} />
      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface p-4 text-sm shadow-[var(--shadow-border)]">
        <div>
          <dt className="text-xs text-muted">Thiết kế</dt>
          <dd>{item.designCode || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Lot</dt>
          <dd className="font-mono">{item.lot}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Số lượng</dt>
          <dd className="font-mono tabular-nums">{item.quantity}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Nhận lúc</dt>
          <dd>{formatDateTime(item.receivedAt)}</dd>
        </div>
      </dl>
      <NativeSelect
        value={item.status}
        onChange={(e) => void upsertDataItem({ ...item, status: e.target.value as DataStatus, id: item.id })}
      >
        {(Object.keys(DATA_STATUS_LABEL) as DataStatus[]).map((s) => (
          <option key={s} value={s}>
            {DATA_STATUS_LABEL[s]}
          </option>
        ))}
      </NativeSelect>
      <Textarea
        defaultValue={item.note}
        onBlur={(e) => {
          if (e.target.value !== item.note) void upsertDataItem({ ...item, note: e.target.value, id: item.id });
        }}
      />
      <PhotoStrip ownerModule="dataItems" ownerId={id} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => missingDataMail({ productCode: item.productCode, invoice: item.invoice, note: item.note })}>
          Mail thiếu DATA
        </Button>
        <Button
          variant="danger"
          onClick={async () => {
            if (!confirm("Xóa DATA?")) return;
            await deleteDataItem(id);
            toast.success("Đã xóa");
            void nav({ to: "/goods" });
          }}
        >
          Xóa
        </Button>
      </div>
    </div>
  );
}
