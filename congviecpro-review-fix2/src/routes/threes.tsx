import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/cvp/page-header";
import { PhotoStrip } from "@/components/cvp/photo-strip";
import { Button } from "@/components/ui/button";
import { useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { useAppStore } from "@/lib/cvp/store";
import { createThreeS, toggleChecklistItem } from "@/lib/cvp/repo";

export const Route = createFileRoute("/threes")({ component: ThreeSPage });

function ThreeSPage() {
  const date = useAppStore((s) => s.selectedDate);
  const shiftId = useAppStore((s) => s.selectedShiftId);
  const records = useRows(
    () => getDb().threeS.filter((t) => t.date === date && (!shiftId || t.shiftId === shiftId)).toArray(),
    [date, shiftId],
  );
  const items = useRows(() => getDb().checklistItems.filter((i) => i.threeSId !== null).toArray());

  return (
    <div className="space-y-4">
      <PageHeader
        title="3S / 3D"
        subtitle="Checklist khu vực trong ca"
        action={
          <Button
            size="sm"
            onClick={async () => {
              if (!shiftId) {
                toast.error("Chưa chọn ca");
                return;
              }
              await createThreeS(date, shiftId);
              toast.success("Đã tạo checklist 3S");
            }}
          >
            Checklist mới
          </Button>
        }
      />
      {records.length === 0 ? (
        <EmptyState title="Chưa có checklist 3S cho ca này" hint="Tạo một phiếu cho khu vực đang làm." />
      ) : (
        records.map((rec) => {
          const recItems = items.filter((i) => i.threeSId === rec.id).sort((a, b) => a.order - b.order);
          const done = recItems.filter((i) => i.done).length;
          return (
            <section key={rec.id} className="space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{rec.note || "Khu vực ca"}</h2>
                <span className="font-mono text-sm tabular-nums text-muted">
                  {done}/{recItems.length}
                </span>
              </div>
              <ul className="space-y-1">
                {recItems.map((item) => (
                  <li key={item.id}>
                    <label className="flex min-h-12 items-center gap-3">
                      <input
                        type="checkbox"
                        className="size-5 accent-primary"
                        checked={item.done}
                        onChange={(e) => void toggleChecklistItem(item.id, e.target.checked)}
                      />
                      <span className={item.done ? "text-muted line-through" : ""}>{item.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <PhotoStrip ownerModule="threeS" ownerId={rec.id} />
            </section>
          );
        })
      )}
    </div>
  );
}
