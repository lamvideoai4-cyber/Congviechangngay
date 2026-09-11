import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cvp/page-header";
import { AbnormalBadge } from "@/components/cvp/status-badge";
import { PhotoStrip } from "@/components/cvp/photo-strip";
import { Button } from "@/components/ui/button";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { useRow, useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { updateAbnormal } from "@/lib/cvp/repo";
import { ABNORMAL_STATUS_LABEL, SEVERITY_LABEL, type AbnormalStatus } from "@/lib/cvp/types";
import { abnormalMail } from "@/lib/cvp/mail";
import { formatDateTime } from "@/lib/cvp/time";

export const Route = createFileRoute("/abnormal/$id")({ component: AbnormalDetail });

function AbnormalDetail() {
  const { id } = Route.useParams();
  const item = useRow(() => getDb().abnormalities.get(id), [id]);
  const people = useRows(() => getDb().employees.toArray());
  if (!item) return <p className="text-muted">Không tìm thấy.</p>;
  const detector = people.find((p) => p.id === item.detectedBy);
  const handler = people.find((p) => p.id === item.handlerId);

  return (
    <div className="space-y-4">
      <PageHeader title={item.type} back="/abnormal" action={<AbnormalBadge status={item.status} />} />
      <p>{item.description}</p>
      <p className="text-sm text-muted">
        {SEVERITY_LABEL[item.severity]} · {detector?.name} · {formatDateTime(item.detectedAt)}
        {handler ? ` · xử lý: ${handler.name}` : ""}
      </p>
      <NativeSelect
        value={item.status}
        onChange={(e) => void updateAbnormal(id, { status: e.target.value as AbnormalStatus })}
      >
        {(Object.keys(ABNORMAL_STATUS_LABEL) as AbnormalStatus[]).map((s) => (
          <option key={s} value={s}>
            {ABNORMAL_STATUS_LABEL[s]}
          </option>
        ))}
      </NativeSelect>
      <Textarea
        defaultValue={item.description}
        onBlur={(e) => {
          if (e.target.value !== item.description) void updateAbnormal(id, { description: e.target.value });
        }}
      />
      <PhotoStrip ownerModule="abnormalities" ownerId={id} />
      <Button
        className="w-full"
        variant="secondary"
        onClick={() =>
          abnormalMail({
            type: item.type,
            description: item.description,
            severity: SEVERITY_LABEL[item.severity],
            detector: detector?.name ?? "",
            time: formatDateTime(item.detectedAt),
          })
        }
      >
        Gửi mail bất thường
      </Button>
    </div>
  );
}
