import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/cvp/page-header";
import { DataBadge, GoodsBadge, LotBadge } from "@/components/cvp/status-badge";
import { FilterChip } from "@/components/cvp/filter-chip";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { useAppStore } from "@/lib/cvp/store";
import { upsertDataItem, upsertGoods, upsertLot } from "@/lib/cvp/repo";
import {
  DATA_STATUS_LABEL,
  GOODS_STATUS_LABEL,
  LOT_STATUS_LABEL,
  type DataStatus,
  type GoodsStatus,
  type LotStatus,
} from "@/lib/cvp/types";
import { can } from "@/lib/cvp/permissions";

export const Route = createFileRoute("/goods/")({ component: GoodsPage });

function GoodsPage() {
  const date = useAppStore((s) => s.selectedDate);
  const role = useAppStore((s) => s.role);
  const [tab, setTab] = useState<"data" | "export" | "lot">("data");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const data = useRows(() => getDb().dataItems.reverse().sortBy("createdAt"));
  const goods = useRows(() => getDb().goodsItems.reverse().sortBy("createdAt"));
  const lots = useRows(() => getDb().lots.reverse().sortBy("createdAt"));

  const dataShown = data.filter((d) => status === "all" || d.status === status);
  const goodsShown = goods.filter((d) => status === "all" || d.status === status);
  const lotsShown = lots.filter((d) => status === "all" || d.status === status);

  return (
    <div>
      <PageHeader
        title="Hàng"
        subtitle="DATA · Xuất · Lot"
        action={
          can(role, "manage_goods") ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              Thêm
            </Button>
          ) : null
        }
      />
      <div className="mb-3 grid grid-cols-3 gap-2">
        {(["data", "export", "lot"] as const).map((t) => (
          <Button key={t} variant={tab === t ? "default" : "secondary"} onClick={() => { setTab(t); setStatus("all"); }}>
            {t === "data" ? "DATA" : t === "export" ? "Hàng xuất" : "Lot"}
          </Button>
        ))}
      </div>
      <div className="mb-3 flex gap-2 overflow-x-auto">
        <FilterChip active={status === "all"} onClick={() => setStatus("all")}>
          Tất cả
        </FilterChip>
        {tab === "data"
          ? (Object.keys(DATA_STATUS_LABEL) as DataStatus[]).map((s) => (
              <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>
                {DATA_STATUS_LABEL[s]}
              </FilterChip>
            ))
          : tab === "export"
            ? (Object.keys(GOODS_STATUS_LABEL) as GoodsStatus[]).map((s) => (
                <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>
                  {GOODS_STATUS_LABEL[s]}
                </FilterChip>
              ))
            : (Object.keys(LOT_STATUS_LABEL) as LotStatus[]).map((s) => (
                <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>
                  {LOT_STATUS_LABEL[s]}
                </FilterChip>
              ))}
      </div>

      {tab === "data" ? (
        dataShown.length === 0 ? (
          <EmptyState title="Chưa có DATA" />
        ) : (
          <ul className="space-y-2">
            {dataShown.map((d) => (
              <li key={d.id}>
                <Link to="/goods/data/$id" params={{ id: d.id }} className="flex items-center justify-between rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
                  <div>
                    <p className="font-medium">{d.productCode}</p>
                    <p className="font-mono text-xs text-muted">{d.invoice} · {d.lot} · SL {d.quantity}</p>
                  </div>
                  <DataBadge status={d.status} />
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === "export" ? (
        goodsShown.length === 0 ? (
          <EmptyState title="Chưa có hàng xuất" />
        ) : (
          <ul className="space-y-2">
            {goodsShown.map((d) => (
              <li key={d.id}>
                <Link to="/goods/export/$id" params={{ id: d.id }} className="flex items-center justify-between rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
                  <div>
                    <p className="font-medium">{d.productCode}</p>
                    <p className="font-mono text-xs text-muted">{d.invoice} · {d.exportDate} · {d.palletCount} pallet · {d.containerCount} cont. · {d.transport === "SEA" ? "Biển" : "Hàng không"}</p>
                  </div>
                  <GoodsBadge status={d.status} />
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === "lot" ? (
        lotsShown.length === 0 ? (
          <EmptyState title="Chưa có Lot" />
        ) : (
          <ul className="space-y-2">
            {lotsShown.map((d) => (
              <li key={d.id}>
                <Link to="/goods/lot/$id" params={{ id: d.id }} className="flex items-center justify-between rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
                  <div>
                    <p className="font-medium">{d.lotCode}</p>
                    <p className="font-mono text-xs text-muted">{d.invoice} · {d.productCode} · SL {d.quantity}</p>
                  </div>
                  <LotBadge status={d.status} />
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}

      <AddGoodsDialog open={open} onClose={() => setOpen(false)} tab={tab} date={date} />
    </div>
  );
}

function AddGoodsDialog({
  open,
  onClose,
  tab,
  date,
}: {
  open: boolean;
  onClose: () => void;
  tab: "data" | "export" | "lot";
  date: string;
}) {
  const [productCode, setPc] = useState("");
  const [designCode, setDc] = useState("");
  const [invoice, setInv] = useState("");
  const [lot, setLot] = useState("");
  const [qty, setQty] = useState("0");
  const [note, setNote] = useState("");
  const [palletCount, setPalletCount] = useState("0");
  const [containerCount, setContainerCount] = useState("0");
  const [transport, setTransport] = useState<"SEA" | "AIR">("SEA");
  const [exportDate, setExportDate] = useState(date);

  return (
    <Dialog open={open} onClose={onClose} title={tab === "data" ? "DATA mới" : tab === "export" ? "Hàng xuất mới" : "Lot mới"}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const quantity = Number(qty) || 0;
          const pallets = Number(palletCount) || 0;
          const containers = Number(containerCount) || 0;
          if (tab === "data") {
            await upsertDataItem({
              productCode,
              designCode,
              receivedAt: Date.now(),
              invoice,
              lot,
              quantity,
              status: "NEW",
              note,
            });
          } else if (tab === "export") {
            await upsertGoods({
              invoice,
              palletCount: pallets,
              containerCount: containers,
              transport,
              exportDate,
              // Keep legacy fields empty for new export-plan records.
              itemCode: "",
              productCode: "",
              lot: "",
              quantity: 0,
              status: "WAITING",
              note: "",
            });
          } else {
            await upsertLot({
              lotCode: lot,
              invoice,
              productCode,
              date,
              quantity,
              status: "OPEN",
            });
          }
          toast.success("Đã lưu");
          setPc("");
          setInv("");
          setLot("");
          setPalletCount("0");
          setContainerCount("0");
          setTransport("SEA");
          setExportDate(date);
          onClose();
        }}
      >
        {tab === "export" ? (
          <>
            <Field label="Invoice">
              <Input value={invoice} onChange={(e) => setInv(e.target.value)} required autoFocus />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Số lượng pallet">
                <Input type="number" min="0" step="1" value={palletCount} onChange={(e) => setPalletCount(e.target.value)} required />
              </Field>
              <Field label="Số lượng container">
                <Input type="number" min="0" step="1" value={containerCount} onChange={(e) => setContainerCount(e.target.value)} required />
              </Field>
            </div>
            <Field label="Hình thức vận chuyển">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-md bg-surface-2 px-3 shadow-[var(--shadow-border)]">
                  <input type="radio" name="transport" value="SEA" checked={transport === "SEA"} onChange={() => setTransport("SEA")} />
                  <span>Đi biển</span>
                </label>
                <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-md bg-surface-2 px-3 shadow-[var(--shadow-border)]">
                  <input type="radio" name="transport" value="AIR" checked={transport === "AIR"} onChange={() => setTransport("AIR")} />
                  <span>Hàng không</span>
                </label>
              </div>
            </Field>
            <Field label="Ngày xuất hàng">
              <Input type="date" value={exportDate} onChange={(e) => setExportDate(e.target.value)} required />
            </Field>
          </>
        ) : (
          <>
            <Field label="Mã SP">
              <Input value={productCode} onChange={(e) => setPc(e.target.value)} required />
            </Field>
            {tab === "data" ? (
              <Field label="Mã thiết kế">
                <Input value={designCode} onChange={(e) => setDc(e.target.value)} />
              </Field>
            ) : null}
            <Field label="Invoice">
              <Input value={invoice} onChange={(e) => setInv(e.target.value)} required />
            </Field>
            <Field label="Lot">
              <Input value={lot} onChange={(e) => setLot(e.target.value)} required />
            </Field>
            <Field label="Số lượng">
              <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
            </Field>
            <Field label="Ghi chú">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </>
        )}
        <Button type="submit" className="w-full">
          Lưu
        </Button>
      </form>
    </Dialog>
  );
}
