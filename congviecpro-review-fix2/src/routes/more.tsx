import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  ClipboardList,
  Clock,
  HardDrive,
  Mail,
  ScrollText,
  Settings,
  Sparkles,
  TriangleAlert,
  Users,
  ArrowLeftRight,
  CalendarCheck,
} from "lucide-react";
import { PageHeader } from "@/components/cvp/page-header";

export const Route = createFileRoute("/more")({ component: MorePage });

const ITEMS = [
  { to: "/people", label: "Nhân sự", desc: "Danh sách, nhóm, ca", icon: Users },
  { to: "/attendance", label: "Chấm công", desc: "Vào / ra / nghỉ", icon: CalendarCheck },
  { to: "/tasks", label: "Công việc", desc: "Khối, checklist, tiến độ", icon: ClipboardList },
  { to: "/ot", label: "OT / AMH", desc: "Khai báo và thống kê giờ", icon: Clock },
  { to: "/threes", label: "3S / 3D", desc: "Checklist khu vực", icon: Sparkles },
  { to: "/abnormal", label: "Bất thường", desc: "Sự cố trong ca", icon: TriangleAlert },
  { to: "/shift-log", label: "Nhật ký ca", desc: "Timeline thao tác", icon: ScrollText },
  { to: "/handover", label: "Bàn giao ca", desc: "Tổng hợp cuối ca", icon: ArrowLeftRight },
  { to: "/mail", label: "Mail", desc: "Soạn từ dữ liệu ca", icon: Mail },
  { to: "/reports", label: "Báo cáo", desc: "Ngày / tuần / tháng", icon: BarChart3 },
  { to: "/backup", label: "Backup", desc: "Xuất, nhập, chia sẻ", icon: HardDrive },
  { to: "/settings", label: "Cài đặt", desc: "Người dùng, dữ liệu mẫu", icon: Settings },
] as const;

function MorePage() {
  return (
    <div>
      <PageHeader title="Module" subtitle="Toàn bộ nghiệp vụ trong ca" />
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className="flex min-h-16 items-center gap-3 rounded-xl bg-surface px-4 shadow-[var(--shadow-border)]"
              >
                <Icon className="size-5 shrink-0 text-muted" />
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-muted">{item.desc}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
