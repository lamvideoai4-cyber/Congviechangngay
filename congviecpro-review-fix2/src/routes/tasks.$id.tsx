import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/cvp/page-header";
import { TaskBadge } from "@/components/cvp/status-badge";
import { PhotoStrip } from "@/components/cvp/photo-strip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useRow, useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { deleteTask, setTaskProgress, toggleChecklistItem, updateTask } from "@/lib/cvp/repo";
import { PROGRESS_STEPS } from "@/lib/cvp/progress";
import { formatDateTime } from "@/lib/cvp/time";
import { can } from "@/lib/cvp/permissions";
import { useAppStore } from "@/lib/cvp/store";

export const Route = createFileRoute("/tasks/$id")({ component: TaskDetail });

function TaskDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const role = useAppStore((s) => s.role);
  const task = useRow(() => getDb().tasks.get(id), [id]);
  const people = useRows(() => getDb().employees.toArray());
  const blocks = useRows(() => getDb().workBlocks.toArray());
  const logs = useRows(
    () => getDb().auditLogs.filter((l) => l.recordId === id).reverse().sortBy("timestamp"),
    [id],
  );
  const checklist = useRows(
    () => getDb().checklists.filter((c) => c.blockId === (task?.blockId ?? "")).toArray(),
    [task?.blockId],
  );
  const items = useRows(async () => {
    const ids = checklist.map((c) => c.id);
    if (!ids.length) return [];
    return getDb().checklistItems.filter((i) => ids.includes(i.checklistId) && (i.taskId === null || i.taskId === id)).toArray();
  }, [checklist, id]);
  const [note, setNote] = useState<string | null>(null);

  if (!task) return <p className="text-muted">Không tìm thấy công việc.</p>;
  const who = people.find((p) => p.id === task.assigneeId);
  const block = blocks.find((b) => b.id === task.blockId);
  const noteVal = note ?? task.note;

  return (
    <div className="space-y-5">
      <PageHeader title={task.name} subtitle={block?.name} back="/tasks" action={<TaskBadge status={task.status} />} />
      <p className="text-sm text-muted">
        {who?.name ?? "Chưa gán"}
        {task.deadline ? ` · hạn ${formatDateTime(task.deadline)}` : ""}
      </p>

      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted">Tiến độ</h2>
          <span className="font-mono tabular-nums">{task.progress}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={task.progress}
          className="w-full accent-primary"
          onChange={(e) => void setTaskProgress(id, Number(e.target.value))}
        />
        <div className="mt-3 grid grid-cols-5 gap-2">
          {PROGRESS_STEPS.map((p) => (
            <Button key={p} size="sm" variant={task.progress === p ? "default" : "secondary"} onClick={() => void setTaskProgress(id, p)}>
              {p}%
            </Button>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="mb-3 text-sm font-medium text-muted">Checklist</h2>
        <ul className="space-y-2">
          {items.map((item) => (
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
          {items.length === 0 ? <p className="text-sm text-muted">Khối này chưa có checklist.</p> : null}
        </ul>
      </section>

      <PhotoStrip ownerModule="tasks" ownerId={id} />

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">Ghi chú</h2>
        <Textarea
          value={noteVal}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note !== null && note !== task.note) void updateTask(id, { note });
          }}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">Lịch sử</h2>
        <ol className="space-y-2 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          {logs.map((l) => (
            <li key={l.id} className="flex gap-3 text-sm">
              <span className="w-14 shrink-0 font-mono tabular-nums text-muted">{formatDateTime(l.timestamp).split(" ")[1]}</span>
              <span>
                <span className="text-muted">{l.userName}</span> {labelAction(l.action)}
              </span>
            </li>
          ))}
          {logs.length === 0 ? <li className="text-sm text-muted">Chưa có lịch sử</li> : null}
        </ol>
      </section>

      {can(role, "manage_tasks") ? (
        <Button
          variant="danger"
          className="w-full"
          onClick={async () => {
            if (!confirm("Xóa công việc?")) return;
            await deleteTask(id);
            toast.success("Đã xóa");
            void nav({ to: "/tasks" });
          }}
        >
          Xóa công việc
        </Button>
      ) : null}
    </div>
  );
}

function labelAction(a: string) {
  const map: Record<string, string> = {
    CREATE: "tạo việc",
    UPDATE: "cập nhật",
    COMPLETE: "hoàn thành",
    PROGRESS: "cập nhật tiến độ",
    PHOTO: "chụp ảnh",
    DELETE: "xóa",
  };
  return map[a] ?? a;
}
