export function openMail(subject: string, body: string) {
  const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
}

export function lotCloseMail(input: {
  lotCode: string;
  invoice: string;
  productCode: string;
  quantity: number;
  closer: string;
  time: string;
  status: string;
  note?: string;
}) {
  const subject = `[CHỐT LOT] ${input.lotCode}`;
  const body = [
    `Lot: ${input.lotCode}`,
    `Invoice: ${input.invoice}`,
    `Mã SP: ${input.productCode}`,
    `Số lượng: ${input.quantity}`,
    `Người thực hiện: ${input.closer}`,
    `Thời gian: ${input.time}`,
    `Trạng thái: ${input.status}`,
    input.note ? `Ghi chú: ${input.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  openMail(subject, body);
}

export function abnormalMail(input: {
  type: string;
  description: string;
  severity: string;
  detector: string;
  time: string;
}) {
  openMail(`[BẤT THƯỜNG] ${input.type}`, [
    `Loại: ${input.type}`,
    `Mức độ: ${input.severity}`,
    `Mô tả: ${input.description}`,
    `Người phát hiện: ${input.detector}`,
    `Thời gian: ${input.time}`,
  ].join("\n"));
}

export function missingDataMail(input: { productCode: string; invoice: string; note: string }) {
  openMail(`[THIẾU DATA] ${input.productCode}`, [
    `Mã SP: ${input.productCode}`,
    `Invoice: ${input.invoice}`,
    `Ghi chú: ${input.note}`,
  ].join("\n"));
}

export function missingGoodsMail(input: { productCode: string; invoice: string; lot: string; note: string }) {
  openMail(`[HÀNG THIẾU] ${input.productCode}`, [
    `Mã SP: ${input.productCode}`,
    `Invoice: ${input.invoice}`,
    `Lot: ${input.lot}`,
    `Ghi chú: ${input.note}`,
  ].join("\n"));
}
