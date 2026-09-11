import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader, Stat } from "@/components/cvp/page-header";
import { AmhBadge } from "@/components/cvp/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { useAppStore } from "@/lib/cvp/store";
import { createAmh, createOvertime, deleteAmh, deleteOvertime, updateAmh } from "@/lib/cvp/repo";
import { computeOtHours } from "@/lib/cvp/ot";
import { formatHours } from "@/lib/cvp/time";
import { OT_TYPES, type AmhStatus } from "@/lib/cvp/types";
import { can } from "@/lib/cvp/permissions";

export const Route = createFileRoute("/ot")({ component: OtPage });

function OtPage() {
  const date = useAppStore((s) => s.selectedDate);
  const shiftId = useAppStore((s) => s.selectedShiftId);
  const role = useAppStore((s) => s.role);
  const round = useAppStore((s) => s.otRoundMinutes);
  const people = useRows(() => getDb().employees.toArray());
  const ots = useRows(() => getDb().overtimes.toArray());
  const amhs = useRows(() => getDb().amhs.toArray());
  const [tab, setTab] = useState<"ot" | "amh">("ot");
  const [open, setOpen] = useState(false);
  const todayOt = ots.filter((o) => o.date === date);
  const totalMin = ots.reduce((s, o) => s + o.totalMinutes, 0);

  return (
    <div>
      <PageHeader
        title="OT / AMH"
        subtitle={`Làm tròn ${round} phút · qua 00:00 tính đúng`}
        action={
          can(role, "manage_ot") ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              Khai báo
            </Button>
          ) : null
        }
      />
      <div className="mb-4 grid grid-cols-3 gap-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <Stat label="Hôm nay" value={`${formatHours(todayOt.reduce((s, o) => s + o.totalMinutes, 0))}h`} />
        <Stat label="Tổng" value={`${formatHours(totalMin)}h`} />
        <Stat label="Phiếu AMH" value={amhs.length} />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Button variant={tab === "ot" ? "default" : "secondary"} onClick={() => setTab("ot")}>
          OT
        </Button>
        <Button variant={tab === "amh" ? "default" : "secondary"} onClick={() => setTab("amh")}>
          AMH
        </Button>
      </div>
      {tab === "ot" ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
          {ots.map((o) => {
            const who = people.find((p) => p.id === o.employeeId);
            return (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{who?.name ?? "—"}</p>
                  <p className="font-mono text-xs text-muted">
                    {o.date} · {o.startTime}–{o.endTime} · {o.type}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono tabular-nums">{formatHours(o.totalMinutes)}h</p>
                  {can(role, "manage_ot") ? (
                    <button className="text-xs text-danger" onClick={() => void deleteOvertime(o.id)}>
                      Xóa
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
          {ots.length === 0 ? <li className="px-4 py-6 text-sm text-muted">Chưa có OT</li> : null}
        </ul>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
          {amhs.map((a) => {
            const who = people.find((p) => p.id === a.employeeId);
            return (
              <li key={a.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{who?.name ?? "—"}</p>
                    <p className="text-xs text-muted">
                      {a.date} · {a.hours}h · {a.note}
                    </p>
                  </div>
                  <AmhBadge status={a.status} />
                </div>
                {can(role, "manage_ot") ? (
                  <div className="mt-2 flex gap-2">
                    {(["APPROVED", "REJECTED", "DONE"] as AmhStatus[]).map((st) => (
                      <Button key={st} size="sm" variant="secondary" onClick={() => void updateAmh(a.id, { status: st })}>
                        {st === "APPROVED" ? "Duyệt" : st === "REJECTED" ? "Từ chối" : "Xong"}
                      </Button>
                    ))}
                    <Button size="sm" variant="danger" onClick={() => void deleteAmh(a.id)}>
                      Xóa
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
          {amhs.length === 0 ? <li className="px-4 py-6 text-sm text-muted">Chưa có AMH</li> : null}
        </ul>
      )}
      <DeclareDialog
        open={open}
        onClose={() => setOpen(false)}
        people={people}
        date={date}
        shiftId={shiftId ?? ""}
        round={round}
        tab={tab}
      />
    </div>
  );
}

function DeclareDialog({
  open,
  onClose,
  people,
  date,
  shiftId,
  round,
  tab,
}: {
  open: boolean;
  onClose: () => void;
  people: { id: string; name: string }[];
  date: string;
  shiftId: string;
  round: number;
  tab: "ot" | "amh";
}) {
  const [employeeId, setEmp] = useState(people[0]?.id ?? "");
  const [startTime, setStart] = useState("14:00");
  const [endTime, setEnd] = useState("16:00");
  const [type, setType] = useState<string>(OT_TYPES[0]);
  const [note, setNote] = useState("");
  const hours = computeOtHours({ startTime, endTime, roundMinutes: round });

  return (
    <Dialog open={open} onClose={onClose} title={tab === "ot" ? "Khai OT" : "Khai AMH"}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (tab === "ot") {
            await createOvertime({ employeeId, date, shiftId, startTime, endTime, type, note });
            toast.success(`Đã lưu OT ${hours} giờ`);
          } else {
            await createAmh({
              employeeId,
              date,
              shiftId,
              hours,
              status: "DECLARED",
              note,
              taskId: null,
            });
            toast.success("Đã lưu AMH");
          }
          onClose();
        }}
      >
        <Field label="Nhân sự">
          <NativeSelect value={employeeId} onChange={(e) => setEmp(e.target.value)}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Bắt đầu">
            <Input type="time" value={startTime} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Kết thúc">
            <Input type="time" value={endTime} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <p className="text-sm text-muted">
          Tự tính: <span className="font-mono tabular-nums text-fg">{hours} giờ</span> (qua nửa đêm vẫn đúng)
        </p>
        {tab === "ot" ? (
          <Field label="Loại">
            <NativeSelect value={type} onChange={(e) => setType(e.target.value)}>
              {OT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </NativeSelect>
          </Field>
        ) : null}
        <Field label="Ghi chú">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full">
          Lưu
        </Button>
      </form>
    </Dialog>
  );
}
