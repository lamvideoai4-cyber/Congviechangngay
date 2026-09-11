import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { createAbnormal } from "@/lib/cvp/repo";
import { useAppStore } from "@/lib/cvp/store";
import { useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { ABNORMAL_TYPES, type AbnormalSeverity } from "@/lib/cvp/types";
import { toast } from "sonner";

export function AbnormalDialog({
  open,
  onClose,
  linkedModule,
  linkedId,
}: {
  open: boolean;
  onClose: () => void;
  linkedModule?: string | null;
  linkedId?: string | null;
}) {
  const userId = useAppStore((s) => s.currentUserId);
  const people = useRows(() => getDb().employees.toArray());
  const [type, setType] = useState<string>(ABNORMAL_TYPES[0]);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<AbnormalSeverity>("MEDIUM");
  const [handlerId, setHandlerId] = useState("");

  return (
    <Dialog open={open} onClose={onClose} title="Báo bất thường">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!description.trim()) {
            toast.error("Nhập mô tả");
            return;
          }
          await createAbnormal({
            type,
            description: description.trim(),
            severity,
            detectedBy: userId ?? people[0]?.id ?? "",
            detectedAt: Date.now(),
            handlerId: handlerId || null,
            deadline: Date.now() + 4 * 3600_000,
            status: "NEW",
            linkedModule: linkedModule ?? null,
            linkedId: linkedId ?? null,
          });
          toast.success("Đã ghi bất thường");
          setDescription("");
          onClose();
        }}
      >
        <Field label="Loại">
          <NativeSelect value={type} onChange={(e) => setType(e.target.value)}>
            {ABNORMAL_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Mức độ">
          <NativeSelect value={severity} onChange={(e) => setSeverity(e.target.value as AbnormalSeverity)}>
            <option value="LOW">Thấp</option>
            <option value="MEDIUM">Trung bình</option>
            <option value="HIGH">Cao</option>
            <option value="CRITICAL">Nghiêm trọng</option>
          </NativeSelect>
        </Field>
        <Field label="Mô tả">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required />
        </Field>
        <Field label="Người xử lý">
          <NativeSelect value={handlerId} onChange={(e) => setHandlerId(e.target.value)}>
            <option value="">Chưa gán</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Liên kết">
          <Input readOnly value={linkedModule ? `${linkedModule}${linkedId ? ` · ${linkedId.slice(0, 8)}` : ""}` : "Không"} />
        </Field>
        <Button type="submit" className="w-full">
          Lưu bất thường
        </Button>
      </form>
    </Dialog>
  );
}
