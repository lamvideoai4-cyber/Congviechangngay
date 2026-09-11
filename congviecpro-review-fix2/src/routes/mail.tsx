import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cvp/page-header";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useRows } from "@/lib/cvp/hooks";
import { getDb } from "@/lib/cvp/db";
import { useAppStore } from "@/lib/cvp/store";
import { lotCloseMail, missingDataMail, missingGoodsMail, openMail } from "@/lib/cvp/mail";
import { formatDateTime } from "@/lib/cvp/time";
import { useState } from "react";

export const Route = createFileRoute("/mail")({ component: MailPage });

function MailPage() {
  const userName = useAppStore((s) => s.currentUserName);
  const lots = useRows(() => getDb().lots.filter((l) => l.status === "CLOSED").toArray());
  const dataMissing = useRows(() => getDb().dataItems.filter((d) => d.status === "MISSING").toArray());
  const goodsMissing = useRows(() => getDb().goodsItems.filter((g) => g.status === "MISSING").toArray());
  const abs = useRows(() => getDb().abnormalities.filter((a) => a.status === "NEW" || a.status === "PROCESSING").toArray());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  return (
    <div className="space-y-4">
      <PageHeader title="Mail" subtitle="Mở ứng dụng email trên máy, nội dung lấy từ dữ liệu ca" />
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted">Mẫu nhanh</h2>
        {lots.slice(0, 3).map((l) => (
          <Button
            key={l.id}
            variant="secondary"
            className="w-full justify-start"
            onClick={() =>
              lotCloseMail({
                lotCode: l.lotCode,
                invoice: l.invoice,
                productCode: l.productCode,
                quantity: l.quantity,
                closer: userName,
                time: formatDateTime(Date.now()),
                status: "Đã chốt",
              })
            }
          >
            Chốt Lot {l.lotCode}
          </Button>
        ))}
        {dataMissing.slice(0, 3).map((d) => (
          <Button
            key={d.id}
            variant="secondary"
            className="w-full justify-start"
            onClick={() => missingDataMail({ productCode: d.productCode, invoice: d.invoice, note: d.note })}
          >
            Thiếu DATA {d.productCode}
          </Button>
        ))}
        {goodsMissing.slice(0, 3).map((g) => (
          <Button
            key={g.id}
            variant="secondary"
            className="w-full justify-start"
            onClick={() =>
              missingGoodsMail({ productCode: g.productCode, invoice: g.invoice, lot: g.lot, note: g.note })
            }
          >
            Hàng thiếu {g.productCode}
          </Button>
        ))}
        {abs.slice(0, 3).map((a) => (
          <Button
            key={a.id}
            variant="secondary"
            className="w-full justify-start"
            onClick={() =>
              openMail(`[BẤT THƯỜNG] ${a.type}`, `${a.description}\nMức độ: ${a.severity}`)
            }
          >
            Bất thường: {a.type}
          </Button>
        ))}
      </section>
      <section className="space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-medium">Soạn mail</h2>
        <Field label="Tiêu đề">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Nội dung">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Button className="w-full" onClick={() => openMail(subject || "(Không tiêu đề)", body)}>
          Mở ứng dụng mail
        </Button>
      </section>
    </div>
  );
}
