import { useCallback, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/cvp/page-header";
import { QrScanner } from "@/components/cvp/qr-scanner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { lookupCode } from "@/lib/cvp/repo";
import { upsertDataItem, upsertLot, createEmployee } from "@/lib/cvp/repo";
import { useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { useAppStore } from "@/lib/cvp/store";

export const Route = createFileRoute("/scan")({ component: ScanPage });

function ScanPage() {
  const nav = useNavigate();
  const date = useAppStore((s) => s.selectedDate);
  const [manual, setManual] = useState("");
  const [unknown, setUnknown] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const groups = useRows(() => getDb().groups.toArray());
  const shifts = useRows(() => getDb().shifts.toArray());

  const handle = useCallback(
    async (text: string) => {
      const hits = await lookupCode(text);
      if (hits.length === 1) {
        go(hits[0]!.module, hits[0]!.id, nav);
        return;
      }
      if (hits.length > 1) {
        go(hits[0]!.module, hits[0]!.id, nav);
        toast.message(`Có ${hits.length} kết quả, mở kết quả đầu`);
        return;
      }
      setUnknown(text);
      setActive(false);
    },
    [nav],
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Quét QR / Barcode" subtitle="Camera thật — tìm nhân sự, DATA, hàng, Lot, invoice" />
      <QrScanner active={active} onDetect={(t) => void handle(t)} />
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handle(manual);
        }}
      >
        <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Nhập mã nếu không quét được" />
        <Button type="submit">Tìm</Button>
      </form>

      <Dialog
        open={Boolean(unknown)}
        onClose={() => {
          setUnknown(null);
          setActive(true);
        }}
        title="Chưa có dữ liệu"
      >
        <p className="mb-3 text-sm">
          Mã <span className="font-mono">{unknown}</span> chưa tồn tại. Tạo mới?
        </p>
        <div className="grid grid-cols-1 gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              const row = await upsertDataItem({
                productCode: unknown ?? "",
                designCode: "",
                receivedAt: Date.now(),
                invoice: "",
                lot: "",
                quantity: 0,
                status: "NEW",
                note: "Tạo từ QR",
              });
              setUnknown(null);
              void nav({ to: "/goods/data/$id", params: { id: row.id } });
            }}
          >
            Tạo DATA
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const row = await upsertLot({
                lotCode: unknown ?? "",
                invoice: "",
                productCode: "",
                date,
                quantity: 0,
                status: "OPEN",
              });
              setUnknown(null);
              void nav({ to: "/goods/lot/$id", params: { id: row.id } });
            }}
          >
            Tạo Lot
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const row = await createEmployee({
                code: unknown ?? "",
                name: unknown ?? "Chưa đặt tên",
                serialNumber: "",
                groupId: groups[0]?.id ?? "",
                shiftId: shifts[0]?.id ?? "",
                status: "ACTIVE",
                role: "USER",
                note: "Tạo từ QR",
              });
              setUnknown(null);
              void nav({ to: "/people/$id", params: { id: row.id } });
            }}
          >
            Tạo nhân sự
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function go(module: string, id: string, nav: ReturnType<typeof useNavigate>) {
  if (module === "employees") void nav({ to: "/people/$id", params: { id } });
  else if (module === "dataItems") void nav({ to: "/goods/data/$id", params: { id } });
  else if (module === "goodsItems") void nav({ to: "/goods/export/$id", params: { id } });
  else if (module === "lots") void nav({ to: "/goods/lot/$id", params: { id } });
  else if (module === "tasks") void nav({ to: "/tasks/$id", params: { id } });
}
