import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ClipboardList,
  LayoutDashboard,
  MoreHorizontal,
  Package,
  QrCode,
  Search,
  TriangleAlert,
} from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { initApp } from "@/lib/cvp/init";
import { useAppStore } from "@/lib/cvp/store";
import { useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { formatDateVi } from "@/lib/cvp/time";
import { applyDate, applyShift } from "@/lib/cvp/init";
import { AbnormalDialog } from "@/components/cvp/abnormal-dialog";
import { NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { headerShifts, shiftLabel } from "@/lib/cvp/shift-catalog";

const NAV = [
  { to: "/", label: "Ca", icon: LayoutDashboard },
  { to: "/unfinished", label: "Chưa xong", icon: ClipboardList },
  { to: "/scan", label: "Quét", icon: QrCode },
  { to: "/goods", label: "Hàng", icon: Package },
  { to: "/more", label: "Thêm", icon: MoreHorizontal },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const ready = useAppStore((s) => s.ready);
  const date = useAppStore((s) => s.selectedDate);
  const shiftId = useAppStore((s) => s.selectedShiftId);
  const autoShift = useAppStore((s) => s.autoShift);
  const userName = useAppStore((s) => s.currentUserName);
  const sample = useAppStore((s) => s.sampleData);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [abnormal, setAbnormal] = useState(false);
  const shifts = useRows(() => getDb().shifts.orderBy("order").toArray());
  const workShifts = headerShifts(shifts);
  const shift = workShifts.find((s) => s.id === shiftId) ?? shifts.find((s) => s.id === shiftId);

  useEffect(() => {
    void initApp();
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg text-fg">
        <p className="text-sm text-muted">Đang mở dữ liệu ca…</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">CongViecPro</p>
            <p className="truncate text-sm">
              {formatDateVi(date)}
              {shift ? ` · ${shift.code ?? shift.name} ${shift.startTime}–${shift.endTime}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Link
              to="/search"
              className="inline-flex size-11 items-center justify-center rounded-md text-fg"
              aria-label="Tìm kiếm"
            >
              <Search className="size-5" />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label="Báo bất thường"
              onClick={() => setAbnormal(true)}
            >
              <TriangleAlert className="size-5" />
            </Button>
            <Link
              to="/settings"
              className="inline-flex size-11 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold"
              aria-label="Tài khoản"
            >
              {userName.slice(0, 1)}
            </Link>
          </div>
        </div>
        <div className="mx-auto mt-2 flex max-w-5xl gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => void applyDate(e.target.value)}
            className="h-10 flex-1 rounded-md bg-surface-2 px-2 text-sm shadow-[var(--shadow-border)]"
          />
          <NativeSelect
            className="h-10 flex-[1.4] text-sm"
            value={shiftId ?? ""}
            onChange={(e) => void applyShift(e.target.value || null, false)}
          >
            {workShifts.map((s) => (
              <option key={s.id} value={s.id}>
                {shiftLabel(s)}
              </option>
            ))}
          </NativeSelect>
        </div>
        {sample ? (
          <p className="mx-auto mt-2 max-w-5xl text-xs text-warn">
            Đang dùng dữ liệu mẫu. Xóa trong Cài đặt khi bắt đầu ca thật.
          </p>
        ) : null}
        {!autoShift ? (
          <p className="mx-auto mt-1 max-w-5xl text-xs text-muted">Ca đang chọn thủ công.</p>
        ) : null}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-4 pb-28">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto grid max-w-5xl grid-cols-5">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]",
                    active ? "text-fg" : "text-muted",
                  )}
                >
                  <Icon className="size-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <AbnormalDialog open={abnormal} onClose={() => setAbnormal(false)} />
      <Toaster theme="dark" position="top-center" />
    </div>
  );
}
