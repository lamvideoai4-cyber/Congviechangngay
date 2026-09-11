import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/cvp/page-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  BACKUP_MODULES,
  backupFilename,
  exportBackup,
  parseBackup,
  restoreBackup,
  type BackupPreview,
  type RestoreMode,
} from "@/lib/cvp/backup";
import type { ModuleKey } from "@/lib/cvp/types";
import { can } from "@/lib/cvp/permissions";
import { useAppStore } from "@/lib/cvp/store";

export const Route = createFileRoute("/backup")({ component: BackupPage });

function BackupPage() {
  const role = useAppStore((s) => s.role);
  const [selected, setSelected] = useState<ModuleKey[]>(BACKUP_MODULES.map((m) => m.key));
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [mode, setMode] = useState<RestoreMode>("merge");
  const allowed = can(role, "backup");

  async function doExport() {
    const blob = await exportBackup(selected);
    const name = backupFilename();
    const file = new File([blob], name, { type: "application/zip" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
    }
    toast.success("Đã tạo file backup");
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Backup" subtitle="Database + ảnh + nhật ký, có version và checksum" />
      {!allowed ? <p className="text-sm text-muted">Tài khoản hiện tại chỉ được xem, không xuất/nhập.</p> : null}
      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="mb-3 font-medium">Chọn module</h2>
        <div className="mb-3 flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setSelected(BACKUP_MODULES.map((m) => m.key))}>
            Tất cả
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Bỏ chọn
          </Button>
        </div>
        <ul className="grid grid-cols-2 gap-2">
          {BACKUP_MODULES.map((m) => (
            <li key={m.key}>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={selected.includes(m.key)}
                  onChange={(e) =>
                    setSelected((cur) => (e.target.checked ? [...cur, m.key] : cur.filter((k) => k !== m.key)))
                  }
                />
                {m.label}
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button disabled={!allowed} onClick={() => void doExport()}>
            Xuất & chia sẻ
          </Button>
          <label className="inline-flex h-12 items-center justify-center rounded-md bg-surface-2 text-sm font-medium shadow-[var(--shadow-border)]">
            Nhập file
            <input
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              disabled={!allowed}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const p = await parseBackup(file);
                if (!p.valid) {
                  toast.error(p.error ?? "File không hợp lệ");
                  return;
                }
                setPreview(p);
              }}
            />
          </label>
        </div>
      </section>
      <p className="text-xs text-muted">
        Trước khi restore, app tự tạo auto-backup. Chọn ghi đè / hợp nhất / bỏ qua trùng — không xóa thầm dữ liệu.
      </p>

      <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} title="Xem trước restore" wide>
        {preview ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Tạo lúc {preview.manifest.createdAt} · version {preview.manifest.backupVersion} · {preview.manifest.imageCount} ảnh
            </p>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {Object.entries(preview.counts).map(([k, n]) => (
                <li key={k} className="flex justify-between">
                  <span>{k}</span>
                  <span className="font-mono tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-3 gap-2">
              {(["overwrite", "merge", "skip"] as RestoreMode[]).map((m) => (
                <Button key={m} size="sm" variant={mode === m ? "default" : "secondary"} onClick={() => setMode(m)}>
                  {m === "overwrite" ? "Ghi đè" : m === "merge" ? "Hợp nhất" : "Bỏ trùng"}
                </Button>
              ))}
            </div>
            <Button
              className="w-full"
              onClick={async () => {
                await restoreBackup(preview, mode, selected.length ? selected : preview.manifest.modules);
                toast.success("Đã restore. Auto-backup đã lưu.");
                setPreview(null);
              }}
            >
              Xác nhận restore
            </Button>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
