import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/cvp/page-header";
import { useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { useAppStore } from "@/lib/cvp/store";
import { formatTime } from "@/lib/cvp/time";

export const Route = createFileRoute("/shift-log")({ component: ShiftLogPage });

const ACTION_VI: Record<string, string> = {
  CREATE: "Tạo",
  UPDATE: "Cập nhật",
  DELETE: "Xóa",
  COMPLETE: "Hoàn thành",
  CHECK_IN: "Chấm vào",
  CHECK_OUT: "Chấm ra",
  OT_CREATE: "Khai OT",
  LOT_CLOSE: "Chốt Lot",
  BACKUP: "Backup",
  RESTORE: "Restore",
  IMPORT: "Import",
  EXPORT: "Export",
  PHOTO: "Chụp ảnh",
  PROGRESS: "Tiến độ",
  HANDOVER: "Bàn giao",
};

function ShiftLogPage() {
  const date = useAppStore((s) => s.selectedDate);
  const shiftId = useAppStore((s) => s.selectedShiftId);
  const logs = useRows(
    () =>
      getDb()
        .auditLogs.filter((l) => l.date === date && (!shiftId || l.shiftId === shiftId || l.shiftId === null))
        .reverse()
        .sortBy("timestamp"),
    [date, shiftId],
  );
  const ordered = [...logs].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div>
      <PageHeader title="Nhật ký ca" subtitle="Timeline từ audit log — không sửa được lịch sử cũ" />
      {ordered.length === 0 ? (
        <EmptyState title="Chưa có thao tác trong ca" hint="Chấm công, nhận việc, chốt lot sẽ hiện ở đây." />
      ) : (
        <ol className="relative space-y-0 border-l border-border pl-4">
          {ordered.map((l) => (
            <li key={l.id} className="relative pb-5">
              <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" />
              <p className="font-mono text-xs tabular-nums text-muted">{formatTime(l.timestamp)}</p>
              <p className="text-sm">
                <span className="font-medium">{l.userName}</span> {ACTION_VI[l.action] ?? l.action}{" "}
                <span className="text-muted">{l.module}</span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
