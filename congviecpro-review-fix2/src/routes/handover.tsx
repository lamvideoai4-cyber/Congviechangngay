import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/cvp/page-header";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { useAppStore } from "@/lib/cvp/store";
import { saveHandover } from "@/lib/cvp/repo";
import { openMail } from "@/lib/cvp/mail";
import { formatDateVi, formatHours } from "@/lib/cvp/time";

export const Route = createFileRoute("/handover")({ component: HandoverPage });

function HandoverPage() {
  const date = useAppStore((s) => s.selectedDate);
  const shiftId = useAppStore((s) => s.selectedShiftId);
  const userName = useAppStore((s) => s.currentUserName);
  const shifts = useRows(() => getDb().shifts.toArray());
  const tasks = useRows(() => getDb().tasks.filter((t) => t.date === date).toArray(), [date]);
  const dataItems = useRows(() => getDb().dataItems.toArray());
  const goods = useRows(() => getDb().goodsItems.filter((g) => g.exportDate === date).toArray(), [date]);
  const lots = useRows(() => getDb().lots.filter((l) => l.date === date).toArray(), [date]);
  const abs = useRows(() => getDb().abnormalities.filter((a) => a.status === "NEW" || a.status === "PROCESSING").toArray());
  const ots = useRows(() => getDb().overtimes.filter((o) => o.date === date).toArray(), [date]);
  const saved = useRows(
    () => getDb().handovers.filter((h) => h.date === date && (!shiftId || h.shiftId === shiftId)).toArray(),
    [date, shiftId],
  );
  const [note, setNote] = useState("");
  const shift = shifts.find((s) => s.id === shiftId);

  const summary = useMemo(() => {
    const done = tasks.filter((t) => t.status === "COMPLETED");
    const open = tasks.filter((t) => t.status !== "COMPLETED");
    const missingData = dataItems.filter((d) => d.status === "MISSING" || d.status === "PROCESSING" || d.status === "NEW");
    const openGoods = goods.filter((g) => g.status !== "COMPLETED" && g.status !== "ENOUGH");
    const openLots = lots.filter((l) => l.status !== "CLOSED");
    const lines = [
      `BÀN GIAO CA · ${formatDateVi(date)} · ${shift?.name ?? ""} ${shift?.startTime ?? ""}–${shift?.endTime ?? ""}`,
      `Người lập: ${userName}`,
      "",
      `Việc hoàn thành: ${done.length}/${tasks.length}`,
      ...done.map((t) => `  - ${t.name}`),
      "",
      `Việc chưa xong: ${open.length}`,
      ...open.map((t) => `  - ${t.name} (${t.progress}%)`),
      "",
      `DATA thiếu/chưa xong: ${missingData.length}`,
      ...missingData.map((d) => `  - ${d.productCode} ${d.invoice} [${d.status}]`),
      "",
      `Hàng chưa xong: ${openGoods.length}`,
      ...openGoods.map((g) => `  - ${g.productCode} ${g.invoice}`),
      "",
      `Lot chưa chốt: ${openLots.length}`,
      ...openLots.map((l) => `  - ${l.lotCode}`),
      "",
      `Bất thường: ${abs.length}`,
      ...abs.map((a) => `  - ${a.type}: ${a.description}`),
      "",
      `OT: ${formatHours(ots.reduce((s, o) => s + o.totalMinutes, 0))} giờ (${ots.length} phiếu)`,
    ];
    return lines.join("\n");
  }, [abs, dataItems, date, goods, lots, ots, shift, tasks, userName]);

  return (
    <div className="space-y-4">
      <PageHeader title="Bàn giao ca" subtitle="Tự tổng hợp việc xong / chưa xong / DATA / Lot / OT" />
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-surface p-4 text-sm shadow-[var(--shadow-border)]">
        {summary}
      </pre>
      <Field label="Ghi chú thêm">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button
          onClick={async () => {
            await saveHandover({ summary, note });
            toast.success("Đã lưu bàn giao");
          }}
        >
          Lưu
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            const text = summary + (note ? `\n\nGhi chú:\n${note}` : "");
            if (navigator.share) await navigator.share({ title: "Bàn giao ca", text });
            else {
              await navigator.clipboard.writeText(text);
              toast.success("Đã copy");
            }
          }}
        >
          Chia sẻ
        </Button>
        <Button
          variant="secondary"
          onClick={() => openMail(`[BÀN GIAO CA] ${formatDateVi(date)} ${shift?.name ?? ""}`, summary + (note ? `\n\n${note}` : ""))}
        >
          Gửi email
        </Button>
      </div>
      {saved.length > 0 ? (
        <p className="text-xs text-muted">Đã lưu {saved.length} bản bàn giao cho ca này.</p>
      ) : null}
    </div>
  );
}
