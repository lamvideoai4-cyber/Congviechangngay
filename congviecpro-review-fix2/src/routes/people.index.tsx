import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/cvp/page-header";
import { EmployeeBadge } from "@/components/cvp/status-badge";
import { FilterChip } from "@/components/cvp/filter-chip";
import { PersonForm } from "@/components/cvp/person-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { can } from "@/lib/cvp/permissions";
import { useAppStore } from "@/lib/cvp/store";
import { createEmployee, createGroup, deleteGroup, renameGroup } from "@/lib/cvp/repo";
import { ROLE_LABEL } from "@/lib/cvp/types";

export const Route = createFileRoute("/people/")({ component: PeoplePage });

function PeoplePage() {
  const role = useAppStore((s) => s.role);
  const people = useRows(() => getDb().employees.orderBy("code").toArray());
  const groups = useRows(() => getDb().groups.orderBy("order").toArray());
  const shifts = useRows(() => getDb().shifts.orderBy("order").toArray());
  const [groupFilter, setGroupFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const filtered = people.filter((p) => groupFilter === "all" || p.groupId === groupFilter);

  return (
    <div>
      <PageHeader
        title="Nhân sự"
        subtitle={`${people.length} người`}
        action={
          can(role, "manage_people") ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              Thêm
            </Button>
          ) : null
        }
      />
      <div className="mb-3 flex gap-2 overflow-x-auto">
        <FilterChip active={groupFilter === "all"} onClick={() => setGroupFilter("all")}>
          Tất cả
        </FilterChip>
        {groups.map((g) => (
          <FilterChip key={g.id} active={groupFilter === g.id} onClick={() => setGroupFilter(g.id)}>
            {g.name}
          </FilterChip>
        ))}
        {can(role, "manage_people") ? (
          <Button variant="ghost" size="sm" onClick={() => setGroupOpen(true)}>
            Nhóm
          </Button>
        ) : null}
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="Chưa có nhân sự" hint="Thêm người để chấm công và giao việc." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
          {filtered.map((p) => {
            const g = groups.find((x) => x.id === p.groupId);
            const s = shifts.find((x) => x.id === p.shiftId);
            return (
              <li key={p.id}>
                <Link to="/people/$id" params={{ id: p.id }} className="flex min-h-16 items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{p.name}</p>
                    <p className="font-mono text-xs text-muted">
                      {p.code} · {g?.name} · {s?.name} · {ROLE_LABEL[p.role]}
                    </p>
                  </div>
                  <EmployeeBadge status={p.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <PersonForm
        open={open}
        onClose={() => setOpen(false)}
        groups={groups}
        shifts={shifts}
        onSave={async (data) => {
          await createEmployee(data);
          toast.success("Đã thêm nhân sự");
          setOpen(false);
        }}
      />

      <Dialog open={groupOpen} onClose={() => setGroupOpen(false)} title="Nhóm">
        <ul className="mb-4 space-y-2">
          {groups.map((g) => (
            <li key={g.id} className="flex gap-2">
              <Input
                defaultValue={g.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== g.name) void renameGroup(g.id, v);
                }}
              />
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  try {
                    await deleteGroup(g.id);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Không xóa được");
                  }
                }}
              >
                Xóa
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="Tên nhóm mới" />
          <Button
            onClick={async () => {
              if (!newGroup.trim()) return;
              await createGroup(newGroup.trim());
              setNewGroup("");
            }}
          >
            Thêm
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
