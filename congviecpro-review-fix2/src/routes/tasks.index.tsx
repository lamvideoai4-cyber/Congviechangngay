import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/cvp/page-header";
import { TaskBadge } from "@/components/cvp/status-badge";
import { FilterChip } from "@/components/cvp/filter-chip";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { useAppStore } from "@/lib/cvp/store";
import { createBlock, createTask, deleteBlock, reorderBlocks, updateBlock } from "@/lib/cvp/repo";
import { can } from "@/lib/cvp/permissions";
import type { TaskStatus } from "@/lib/cvp/types";
import { TASK_STATUS_LABEL } from "@/lib/cvp/types";

export const Route = createFileRoute("/tasks/")({ component: TasksPage });

function TasksPage() {
  const date = useAppStore((s) => s.selectedDate);
  const shiftId = useAppStore((s) => s.selectedShiftId);
  const role = useAppStore((s) => s.role);
  const tasks = useRows(
    () => getDb().tasks.filter((t) => t.date === date && (!shiftId || t.shiftId === shiftId)).toArray(),
    [date, shiftId],
  );
  const blocks = useRows(() => getDb().workBlocks.orderBy("order").toArray());
  const people = useRows(() => getDb().employees.toArray());
  const [filter, setFilter] = useState<"all" | TaskStatus | "today">("all");
  const [open, setOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const shown = tasks.filter((t) => {
    if (filter === "all" || filter === "today") return true;
    return t.status === filter;
  });

  return (
    <div>
      <PageHeader
        title="Công việc"
        subtitle={`${shown.length} việc trong ca`}
        action={
          can(role, "manage_tasks") ? (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setBlockOpen(true)}>
                Khối
              </Button>
              <Button size="sm" onClick={() => setOpen(true)}>
                Thêm
              </Button>
            </div>
          ) : null
        }
      />
      <div className="mb-3 flex gap-2 overflow-x-auto">
        {(["all", "IN_PROGRESS", "OVERDUE", "COMPLETED"] as const).map((f) => (
          <FilterChip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f === "all" ? "Tất cả" : TASK_STATUS_LABEL[f]}
          </FilterChip>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState title="Chưa có công việc" hint="Tạo việc theo khối DATA, hàng xuất, lot…" />
      ) : (
        <ul className="space-y-2">
          {shown.map((t) => {
            const block = blocks.find((b) => b.id === t.blockId);
            const who = people.find((p) => p.id === t.assigneeId);
            return (
              <li key={t.id}>
                <Link
                  to="/tasks/$id"
                  params={{ id: t.id }}
                  className="block rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted">
                        {block?.name} · {who?.name ?? "Chưa gán"}
                      </p>
                    </div>
                    <TaskBadge status={t.status} />
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full bg-primary" style={{ width: `${t.progress}%` }} />
                  </div>
                  <p className="mt-1 font-mono text-xs tabular-nums text-muted">{t.progress}%</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <TaskCreate open={open} onClose={() => setOpen(false)} blocks={blocks} people={people} />
      <BlockManager open={blockOpen} onClose={() => setBlockOpen(false)} blocks={blocks} />
    </div>
  );
}

function TaskCreate({
  open,
  onClose,
  blocks,
  people,
}: {
  open: boolean;
  onClose: () => void;
  blocks: { id: string; name: string }[];
  people: { id: string; name: string }[];
}) {
  const date = useAppStore((s) => s.selectedDate);
  const shiftId = useAppStore((s) => s.selectedShiftId);
  const [name, setName] = useState("");
  const [blockId, setBlockId] = useState(blocks[0]?.id ?? "");
  const [assigneeId, setAssignee] = useState(people[0]?.id ?? "");
  const [minutes, setMinutes] = useState("30");
  const [note, setNote] = useState("");
  const [deadlineLocal, setDeadline] = useState("");

  return (
    <Dialog open={open} onClose={onClose} title="Công việc mới">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await createTask({
            name,
            blockId,
            assigneeId,
            date,
            shiftId: shiftId ?? "",
            estimatedMinutes: Number(minutes) || 30,
            deadline: deadlineLocal ? new Date(deadlineLocal).getTime() : Date.now() + 4 * 3600_000,
            reminderTime: deadlineLocal ? new Date(deadlineLocal).getTime() - 30 * 60_000 : null,
            note,
          });
          toast.success("Đã tạo công việc");
          setName("");
          onClose();
        }}
      >
        <Field label="Tên">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Khối">
          <NativeSelect value={blockId} onChange={(e) => setBlockId(e.target.value)}>
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Người làm">
          <NativeSelect value={assigneeId} onChange={(e) => setAssignee(e.target.value)}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Thời gian dự kiến (phút)">
          <Input type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </Field>
        <Field label="Deadline">
          <Input type="datetime-local" value={deadlineLocal} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
        <Field label="Ghi chú">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full">
          Tạo
        </Button>
      </form>
    </Dialog>
  );
}

function BlockManager({
  open,
  onClose,
  blocks,
}: {
  open: boolean;
  onClose: () => void;
  blocks: { id: string; name: string; order: number }[];
}) {
  const [name, setName] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title="Khối công việc">
      <ul className="space-y-2">
        {blocks.map((b, i) => (
          <li key={b.id} className="flex gap-2">
            <Input
              defaultValue={b.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== b.name) void updateBlock(b.id, v);
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={i === 0}
              onClick={() => {
                const ids = blocks.map((x) => x.id);
                [ids[i - 1], ids[i]] = [ids[i]!, ids[i - 1]!];
                void reorderBlocks(ids);
              }}
            >
              Lên
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                try {
                  await deleteBlock(b.id);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Không xóa được");
                }
              }}
            >
              Xóa
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Khối mới" />
        <Button
          onClick={async () => {
            if (!name.trim()) return;
            await createBlock(name.trim());
            setName("");
          }}
        >
          Thêm
        </Button>
      </div>
    </Dialog>
  );
}
