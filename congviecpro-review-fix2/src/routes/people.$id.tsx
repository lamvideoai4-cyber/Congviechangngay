import { useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/cvp/page-header";
import { EmployeeBadge } from "@/components/cvp/status-badge";
import { Button } from "@/components/ui/button";
import { PersonForm } from "@/components/cvp/person-form";
import { useRow, useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { deleteEmployee, updateEmployee } from "@/lib/cvp/repo";
import { can } from "@/lib/cvp/permissions";
import { useAppStore } from "@/lib/cvp/store";
import { ROLE_LABEL } from "@/lib/cvp/types";
import { formatDateTime } from "@/lib/cvp/time";

export const Route = createFileRoute("/people/$id")({ component: PersonDetail });

function PersonDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const role = useAppStore((s) => s.role);
  const person = useRow(() => getDb().employees.get(id), [id]);
  const groups = useRows(() => getDb().groups.toArray());
  const shifts = useRows(() => getDb().shifts.toArray());
  const attendance = useRows(
    () => getDb().attendance.where("employeeId").equals(id).reverse().sortBy("createdAt"),
    [id],
  );
  const ots = useRows(() => getDb().overtimes.where("employeeId").equals(id).toArray(), [id]);
  const [edit, setEdit] = useState(false);
  if (!person) return <p className="text-muted">Không tìm thấy nhân sự.</p>;
  const g = groups.find((x) => x.id === person.groupId);
  const s = shifts.find((x) => x.id === person.shiftId);

  return (
    <div className="space-y-4">
      <PageHeader
        title={person.name}
        subtitle={person.code}
        back="/people"
        action={
          can(role, "manage_people") ? (
            <Button size="sm" variant="secondary" onClick={() => setEdit(true)}>
              Sửa
            </Button>
          ) : null
        }
      />
      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Item k="Nhóm" v={g?.name ?? "—"} />
          <Item k="Ca" v={s ? `${s.name} ${s.startTime}–${s.endTime}` : "—"} />
          <Item k="Quyền" v={ROLE_LABEL[person.role]} />
          <Item k="Trạng thái" v={<EmployeeBadge status={person.status} />} />
          <Item k="SBD" v={person.serialNumber || "—"} />
          <Item k="Ghi chú" v={person.note || "—"} />
        </dl>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">Chấm công gần đây</h2>
        <ul className="divide-y divide-border rounded-xl bg-surface px-4 shadow-[var(--shadow-border)]">
          {attendance.slice(0, 8).map((a) => (
            <li key={a.id} className="flex min-h-12 items-center justify-between text-sm">
              <span>{a.date}</span>
              <span className="font-mono text-muted tabular-nums">
                {a.checkIn ? formatDateTime(a.checkIn) : "—"} → {a.checkOut ? formatDateTime(a.checkOut) : "—"}
              </span>
            </li>
          ))}
          {attendance.length === 0 ? <li className="py-4 text-sm text-muted">Chưa có</li> : null}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">OT</h2>
        <p className="text-sm text-muted">{ots.length} phiếu · {Math.round(ots.reduce((s, o) => s + o.totalMinutes, 0) / 6) / 10} giờ</p>
      </section>
      {can(role, "manage_people") ? (
        <Button
          variant="danger"
          className="w-full"
          onClick={async () => {
            if (!confirm("Xóa nhân sự này?")) return;
            await deleteEmployee(id);
            toast.success("Đã xóa");
            void nav({ to: "/people" });
          }}
        >
          Xóa nhân sự
        </Button>
      ) : null}
      <PersonForm
        open={edit}
        onClose={() => setEdit(false)}
        groups={groups}
        shifts={shifts}
        initial={person}
        onSave={async (data) => {
          await updateEmployee(id, data);
          toast.success("Đã cập nhật");
          setEdit(false);
        }}
      />
    </div>
  );
}

function Item({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="mt-0.5">{v}</dd>
    </div>
  );
}
