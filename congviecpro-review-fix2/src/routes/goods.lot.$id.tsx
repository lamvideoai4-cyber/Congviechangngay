import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/cvp/page-header";
import { LotBadge } from "@/components/cvp/status-badge";
import { PhotoStrip } from "@/components/cvp/photo-strip";
import { Button } from "@/components/ui/button";
import { Field, NativeSelect, Textarea } from "@/components/ui/input";
import { useRow, useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { closeLot, upsertLot } from "@/lib/cvp/repo";
import { LOT_STATUS_LABEL, type LotStatus } from "@/lib/cvp/types";
import { lotCloseMail } from "@/lib/cvp/mail";
import { formatDateTime } from "@/lib/cvp/time";
import { useAppStore } from "@/lib/cvp/store";

export const Route = createFileRoute("/goods/lot/$id")({ component: LotDetail });

function LotDetail() {
  const { id } = Route.useParams();
  const userName = useAppStore((s) => s.currentUserName);
  const lot = useRow(() => getDb().lots.get(id), [id]);
  const closures = useRows(() => getDb().lotClosures.where("lotId").equals(id).toArray(), [id]);
  const people = useRows(() => getDb().employees.toArray());
  const [note, setNote] = useState("");
  if (!lot) return <p className="text-muted">Không tìm thấy Lot.</p>;
  const closed = lot.status === "CLOSED";

  return (
    <div className="space-y-4">
      <PageHeader title={lot.lotCode} subtitle={lot.invoice} back="/goods" action={<LotBadge status={lot.status} />} />
      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface p-4 text-sm shadow-[var(--shadow-border)]">
        <div>
          <dt className="text-xs text-muted">Mã SP</dt>
          <dd className="font-mono">{lot.productCode}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Số lượng</dt>
          <dd className="font-mono tabular-nums">{lot.quantity}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Ngày</dt>
          <dd>{lot.date}</dd>
        </div>
      </dl>
      {!closed ? (
        <NativeSelect
          value={lot.status}
          onChange={(e) => {
            const status = e.target.value as LotStatus;
            if (status === "CLOSED") return;
            void upsertLot({ ...lot, status, id: lot.id });
          }}
        >
          {(["OPEN", "PROCESSING", "ENOUGH"] as LotStatus[]).map((s) => (
            <option key={s} value={s}>
              {LOT_STATUS_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
      ) : null}
      <PhotoStrip ownerModule="lots" ownerId={id} />
      {!closed ? (
        <section className="space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="font-medium">Chốt Lot</h2>
          <p className="text-sm text-muted">Ghi người thực hiện, thời gian, ghi chú. Không xóa được lịch sử chốt.</p>
          <Field label="Ghi chú chốt">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Button
            className="w-full"
            onClick={async () => {
              try {
                await closeLot(id, note, null);
                toast.success("Đã chốt Lot");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Không chốt được");
              }
            }}
          >
            Xác nhận chốt
          </Button>
        </section>
      ) : (
        <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="mb-2 font-medium">Lịch sử chốt</h2>
          {closures.map((c) => {
            const who = people.find((p) => p.id === c.closedBy);
            return (
              <div key={c.id} className="text-sm">
                <p>
                  {who?.name ?? c.closedBy} · {formatDateTime(c.closedAt)}
                </p>
                <p className="text-muted">{c.note || "Không ghi chú"}</p>
                <Button
                  className="mt-3 w-full"
                  variant="secondary"
                  onClick={() =>
                    lotCloseMail({
                      lotCode: lot.lotCode,
                      invoice: lot.invoice,
                      productCode: lot.productCode,
                      quantity: lot.quantity,
                      closer: who?.name ?? userName,
                      time: formatDateTime(c.closedAt),
                      status: "Đã chốt",
                      note: c.note,
                    })
                  }
                >
                  Gửi mail chốt Lot
                </Button>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
