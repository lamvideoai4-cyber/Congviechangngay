import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/cvp/page-header";
import { GoodsBadge } from "@/components/cvp/status-badge";
import { PhotoStrip } from "@/components/cvp/photo-strip";
import { Button } from "@/components/ui/button";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { useRow } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { deleteGoods, upsertGoods } from "@/lib/cvp/repo";
import { GOODS_STATUS_LABEL, type GoodsStatus } from "@/lib/cvp/types";
import { missingGoodsMail } from "@/lib/cvp/mail";

export const Route = createFileRoute("/goods/export/$id")({ component: ExportDetail });

function ExportDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const item = useRow(() => getDb().goodsItems.get(id), [id]);
  if (!item) return <p className="text-muted">Không tìm thấy hàng xuất.</p>;
  return (
    <div className="space-y-4">
      <PageHeader title={item.productCode} subtitle={item.invoice} back="/goods" action={<GoodsBadge status={item.status} />} />
      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface p-4 text-sm shadow-[var(--shadow-border)]">
        <div>
          <dt className="text-xs text-muted">Pallet</dt>
          <dd className="font-mono tabular-nums">{item.palletCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Container</dt>
          <dd className="font-mono tabular-nums">{item.containerCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Vận chuyển</dt>
          <dd>{item.transport === "SEA" ? "Đi biển" : "Hàng không"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Ngày xuất</dt>
          <dd>{item.exportDate}</dd>
        </div>
      </dl>
      <NativeSelect
        value={item.status}
        onChange={(e) => void upsertGoods({ ...item, status: e.target.value as GoodsStatus, id: item.id })}
      >
        {(Object.keys(GOODS_STATUS_LABEL) as GoodsStatus[]).map((s) => (
          <option key={s} value={s}>
            {GOODS_STATUS_LABEL[s]}
          </option>
        ))}
      </NativeSelect>
      <Textarea
        defaultValue={item.note}
        onBlur={(e) => {
          if (e.target.value !== item.note) void upsertGoods({ ...item, note: e.target.value, id: item.id });
        }}
      />
      <PhotoStrip ownerModule="goodsItems" ownerId={id} />
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={() =>
            missingGoodsMail({ productCode: item.productCode, invoice: item.invoice, lot: item.lot, note: item.note })
          }
        >
          Mail hàng thiếu
        </Button>
        <Button
          variant="danger"
          onClick={async () => {
            if (!confirm("Xóa phiếu xuất?")) return;
            await deleteGoods(id);
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
