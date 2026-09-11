import { Badge } from "@/components/ui/badge";
import {
  ABNORMAL_STATUS_LABEL,
  AMH_STATUS_LABEL,
  ATTENDANCE_STATUS_LABEL,
  DATA_STATUS_LABEL,
  EMPLOYEE_STATUS_LABEL,
  GOODS_STATUS_LABEL,
  LOT_STATUS_LABEL,
  TASK_STATUS_LABEL,
  type AbnormalStatus,
  type AmhStatus,
  type AttendanceStatus,
  type DataStatus,
  type EmployeeStatus,
  type GoodsStatus,
  type LotStatus,
  type TaskStatus,
} from "@/lib/cvp/types";

type Tone = "ok" | "warn" | "danger" | "info" | "muted" | "default";

function taskTone(s: TaskStatus): Tone {
  if (s === "COMPLETED") return "ok";
  if (s === "OVERDUE") return "danger";
  if (s === "IN_PROGRESS") return "info";
  if (s === "PAUSED") return "warn";
  return "muted";
}
function dataTone(s: DataStatus): Tone {
  if (s === "COMPLETED" || s === "ENOUGH" || s === "PUSHED") return "ok";
  if (s === "MISSING") return "danger";
  if (s === "PROCESSING") return "info";
  return "muted";
}
function goodsTone(s: GoodsStatus): Tone {
  if (s === "COMPLETED" || s === "ENOUGH") return "ok";
  if (s === "MISSING") return "danger";
  if (s === "PROCESSING" || s === "PREPARING") return "info";
  return "muted";
}
function lotTone(s: LotStatus): Tone {
  if (s === "CLOSED" || s === "ENOUGH") return "ok";
  if (s === "PROCESSING") return "info";
  return "warn";
}

export function TaskBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={taskTone(status)}>{TASK_STATUS_LABEL[status]}</Badge>;
}
export function DataBadge({ status }: { status: DataStatus }) {
  return <Badge tone={dataTone(status)}>{DATA_STATUS_LABEL[status]}</Badge>;
}
export function GoodsBadge({ status }: { status: GoodsStatus }) {
  return <Badge tone={goodsTone(status)}>{GOODS_STATUS_LABEL[status]}</Badge>;
}
export function LotBadge({ status }: { status: LotStatus }) {
  return <Badge tone={lotTone(status)}>{LOT_STATUS_LABEL[status]}</Badge>;
}
export function AbnormalBadge({ status }: { status: AbnormalStatus }) {
  const tone: Tone =
    status === "CLOSED" || status === "RESOLVED" ? "ok" : status === "NEW" ? "danger" : "warn";
  return <Badge tone={tone}>{ABNORMAL_STATUS_LABEL[status]}</Badge>;
}
export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const tone: Tone =
    status === "PRESENT" || status === "CHECKED_IN" || status === "OVERTIME"
      ? "ok"
      : status === "ABSENT"
        ? "danger"
        : status === "PLANNED"
          ? "muted"
          : "warn";
  return <Badge tone={tone}>{ATTENDANCE_STATUS_LABEL[status]}</Badge>;
}
export function EmployeeBadge({ status }: { status: EmployeeStatus }) {
  return (
    <Badge tone={status === "ACTIVE" ? "ok" : status === "LEAVE" ? "warn" : "muted"}>
      {EMPLOYEE_STATUS_LABEL[status]}
    </Badge>
  );
}
export function AmhBadge({ status }: { status: AmhStatus }) {
  const tone: Tone = status === "APPROVED" || status === "DONE" ? "ok" : status === "REJECTED" ? "danger" : "info";
  return <Badge tone={tone}>{AMH_STATUS_LABEL[status]}</Badge>;
}
