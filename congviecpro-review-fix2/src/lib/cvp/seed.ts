import { nid } from "./ids";
import { formatDate, addDays } from "./time";
import type { CvpDB } from "./db";
import type {
  Abnormality,
  Amh,
  Attendance,
  Checklist,
  ChecklistItem,
  DataItem,
  Employee,
  GoodsItem,
  Group,
  Lot,
  Overtime,
  Shift,
  Task,
  ThreeSRecord,
  WorkBlock,
} from "./types";
import { SHIFT_CATALOG, toShiftRow } from "./shift-catalog";

const BLOCK_NAMES = [
  "DATA",
  "Hàng xuất",
  "Chốt Lot",
  "AMH",
  "3S / 3D",
  "Kiểm kê",
  "Mail",
];

const CHECKLIST_BY_BLOCK: Record<string, string[]> = {
  DATA: ["Kiểm tra DATA", "Đối chiếu invoice", "Xác nhận số lượng"],
  "Hàng xuất": ["Kiểm tra hàng xuất", "Kiểm tra hàng thiếu", "Đóng gói"],
  "Chốt Lot": ["Kiểm tra Lot", "Đối chiếu DATA", "Xác nhận người chốt"],
  AMH: ["Khai báo AMH", "Đối chiếu giờ OT"],
  "3S / 3D": ["Sàng lọc", "Sắp xếp", "Sạch sẽ", "Săn sóc / Duy trì", "Sẵn sàng / Kỷ luật", "3D"],
  "Kiểm kê": ["Đếm tồn", "Đối chiếu hệ thống"],
  Mail: ["Soạn mail chốt Lot", "Gửi báo cáo ca"],
};

export async function seedCatalog(db: CvpDB): Promise<{
  shifts: Shift[];
  groups: Group[];
  blocks: WorkBlock[];
}> {
  const shifts: Shift[] = SHIFT_CATALOG.map((def) => toShiftRow(def));
  const groups: Group[] = [
    { id: "group-1", name: "Tổ thành phẩm E", order: 1 },
    { id: "group-2", name: "Nhóm 2", order: 2 },
  ];
  const blocks: WorkBlock[] = BLOCK_NAMES.map((name, i) => ({
    id: `block-${i + 1}`,
    name,
    order: i + 1,
  }));
  const checklists: Checklist[] = [];
  const items: ChecklistItem[] = [];
  for (const block of blocks) {
    const cl: Checklist = {
      id: `cl-${block.id}`,
      blockId: block.id,
      name: `Checklist ${block.name}`,
    };
    checklists.push(cl);
    (CHECKLIST_BY_BLOCK[block.name] ?? []).forEach((label, idx) => {
      items.push({
        id: nid(),
        checklistId: cl.id,
        taskId: null,
        threeSId: null,
        label,
        done: false,
        completedAt: null,
        completedBy: null,
        photoId: null,
        note: "",
        order: idx + 1,
      });
    });
  }
  await db.shifts.bulkAdd(shifts);
  await db.groups.bulkAdd(groups);
  await db.workBlocks.bulkAdd(blocks);
  await db.checklists.bulkAdd(checklists);
  await db.checklistItems.bulkAdd(items);
  return { shifts, groups, blocks };
}

export async function seedSampleData(db: CvpDB): Promise<void> {
  const now = Date.now();
  const today = formatDate(new Date());
  const shifts = await db.shifts.orderBy("order").toArray();
  const groups = await db.groups.orderBy("order").toArray();
  const blocks = await db.workBlocks.orderBy("order").toArray();
  const caM = shifts.find((s) => s.code === "M")?.id ?? "shift-M";
  const caX = shifts.find((s) => s.code === "X")?.id ?? "shift-X";
  const caA = shifts.find((s) => s.code === "A")?.id ?? "shift-A";
  const caD = shifts.find((s) => s.code === "D")?.id ?? "shift-D";
  const g1 = groups[0]?.id ?? "group-1";
  const g2 = groups[1]?.id ?? "group-2";

  const people: Array<Omit<Employee, "id" | "createdAt" | "updatedAt" | "sample">> = [
    { code: "NV001", name: "Nguyễn Văn An", serialNumber: "00001", position: "Chief Leader", phone: "", groupId: g1, shiftId: caM, status: "ACTIVE", role: "ADMIN", note: "Tổ trưởng" },
    { code: "NV002", name: "Trần Thị Bình", serialNumber: "00002", position: "Leader", phone: "", groupId: g1, shiftId: caM, status: "ACTIVE", role: "LEADER", note: "" },
    { code: "NV003", name: "Lê Văn Cường", serialNumber: "00003", position: "Đóng Cont,IGHS", phone: "", groupId: g1, shiftId: caM, status: "ACTIVE", role: "USER", note: "" },
    { code: "NV004", name: "Phạm Thị Dung", serialNumber: "00004", position: "Trainer I", phone: "", groupId: g1, shiftId: caM, status: "ACTIVE", role: "USER", note: "" },
    { code: "NV005", name: "Hoàng Văn Em", serialNumber: "00005", position: "Lái Xe,IGHS", phone: "", groupId: g2, shiftId: caM, status: "ACTIVE", role: "USER", note: "" },
    { code: "NV006", name: "Võ Thị Phương", serialNumber: "00006", position: "Cấp,nhận hàng", phone: "", groupId: g2, shiftId: caM, status: "ACTIVE", role: "USER", note: "" },
    { code: "NV007", name: "Đặng Văn Giang", serialNumber: "00007", position: "Đóng Cont,IGHS", phone: "", groupId: g2, shiftId: caA, status: "ACTIVE", role: "USER", note: "Ca chiều A" },
    { code: "NV008", name: "Bùi Thị Hoa", serialNumber: "00008", position: "IGHS", phone: "", groupId: g1, shiftId: caX, status: "ACTIVE", role: "USER", note: "" },
    { code: "NV009", name: "Ngô Văn Ích", serialNumber: "00009", position: "Lái Xe", phone: "", groupId: g2, shiftId: caD, status: "ACTIVE", role: "USER", note: "Ca đêm D" },
    { code: "NV010", name: "Lý Thị Kim", serialNumber: "00010", position: "Cấp,nhận hàng", phone: "", groupId: g1, shiftId: caX, status: "LEAVE", role: "VIEWER", note: "Nghỉ phép" },
  ];

  const employees: Employee[] = people.map((p) => ({
    ...p,
    id: nid(),
    sample: true,
    createdAt: now,
    updatedAt: now,
  }));
  await db.employees.bulkAdd(employees);

  const byCode = (code: string) => employees.find((e) => e.code === code)!;
  const an = byCode("NV001");
  const binh = byCode("NV002");
  const cuong = byCode("NV003");
  const dung = byCode("NV004");
  const em = byCode("NV005");

  const attendance: Attendance[] = employees
    .filter((e) => e.shiftId === caM && e.status === "ACTIVE")
    .map((e, i) => {
      const late = i === 5;
      const absent = false;
      const checkIn = absent ? null : now - 3 * 60 * 60 * 1000 + (late ? 20 * 60 * 1000 : 0);
      return {
        id: nid(),
        employeeId: e.id,
        date: today,
        shiftId: caM,
        checkIn,
        checkOut: null,
        status: absent ? "ABSENT" : late ? "LATE" : "PRESENT",
        otMinutes: 0,
        lateMinutes: late ? 20 : 0,
        arrived: !absent,
        declareCode: "M",
        note: late ? "Đến muộn 20 phút" : "",
        sample: true,
        createdAt: now,
      };
    });
  // Two people not yet checked in to show "thiếu"
  attendance.pop();
  attendance.pop();
  await db.attendance.bulkAdd(attendance);

  const dataBlock = blocks.find((b) => b.name === "DATA")!;
  const hangBlock = blocks.find((b) => b.name === "Hàng xuất")!;
  const lotBlock = blocks.find((b) => b.name === "Chốt Lot")!;
  const amhBlock = blocks.find((b) => b.name === "AMH")!;
  const s3Block = blocks.find((b) => b.name === "3S / 3D")!;

  const tasks: Task[] = [
    {
      id: nid(),
      name: "Nhận DATA SP001",
      blockId: dataBlock.id,
      assigneeId: cuong.id,
      date: today,
      shiftId: caM,
      estimatedMinutes: 30,
      deadline: now + 40 * 60 * 1000,
      reminderTime: now + 10 * 60 * 1000,
      status: "COMPLETED",
      progress: 100,
      note: "Đã nhận đủ",
      sample: true,
      createdAt: now - 4 * 3600_000,
      updatedAt: now - 3 * 3600_000,
      completedAt: now - 3 * 3600_000,
    },
    {
      id: nid(),
      name: "Kiểm tra hàng xuất INV-260901-01",
      blockId: hangBlock.id,
      assigneeId: dung.id,
      date: today,
      shiftId: caM,
      estimatedMinutes: 45,
      deadline: now + 90 * 60 * 1000,
      reminderTime: now + 30 * 60 * 1000,
      status: "IN_PROGRESS",
      progress: 50,
      note: "",
      sample: true,
      createdAt: now - 2 * 3600_000,
      updatedAt: now - 30 * 60_000,
      completedAt: null,
    },
    {
      id: nid(),
      name: "Chốt Lot LOT-260901-08",
      blockId: lotBlock.id,
      assigneeId: binh.id,
      date: today,
      shiftId: caM,
      estimatedMinutes: 20,
      deadline: now + 2 * 3600_000,
      reminderTime: now + 90 * 60_000,
      status: "TODO",
      progress: 0,
      note: "",
      sample: true,
      createdAt: now - 3600_000,
      updatedAt: now - 3600_000,
      completedAt: null,
    },
    {
      id: nid(),
      name: "Khai AMH cuối ca",
      blockId: amhBlock.id,
      assigneeId: an.id,
      date: today,
      shiftId: caM,
      estimatedMinutes: 15,
      deadline: now + 5 * 3600_000,
      reminderTime: now + 4 * 3600_000,
      status: "TODO",
      progress: 0,
      note: "",
      sample: true,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    },
    {
      id: nid(),
      name: "3S khu đóng gói",
      blockId: s3Block.id,
      assigneeId: em.id,
      date: today,
      shiftId: caM,
      estimatedMinutes: 25,
      deadline: now - 20 * 60_000,
      reminderTime: now - 40 * 60_000,
      status: "OVERDUE",
      progress: 25,
      note: "Chưa xong góc kệ B",
      sample: true,
      createdAt: now - 5 * 3600_000,
      updatedAt: now - 3600_000,
      completedAt: null,
    },
  ];
  await db.tasks.bulkAdd(tasks);

  const dataItems: DataItem[] = [
    {
      id: nid(),
      productCode: "SP-001",
      designCode: "TK-A12",
      receivedAt: now - 5 * 3600_000,
      invoice: "INV-260901-01",
      lot: "LOT-260901-08",
      quantity: 1200,
      status: "COMPLETED",
      note: "",
      sample: true,
      createdAt: now - 5 * 3600_000,
      updatedAt: now - 3 * 3600_000,
      completedAt: now - 3 * 3600_000,
    },
    {
      id: nid(),
      productCode: "SP-002",
      designCode: "TK-B04",
      receivedAt: now - 2 * 3600_000,
      invoice: "INV-260901-02",
      lot: "LOT-260901-09",
      quantity: 800,
      status: "MISSING",
      note: "Thiếu 40 pcs so với invoice",
      sample: true,
      createdAt: now - 2 * 3600_000,
      updatedAt: now - 20 * 60_000,
      completedAt: null,
    },
    {
      id: nid(),
      productCode: "SP-003",
      designCode: "TK-C21",
      receivedAt: now - 3600_000,
      invoice: "INV-260901-03",
      lot: "LOT-260901-10",
      quantity: 500,
      status: "PROCESSING",
      note: "",
      sample: true,
      createdAt: now - 3600_000,
      updatedAt: now - 3600_000,
      completedAt: null,
    },
  ];
  await db.dataItems.bulkAdd(dataItems);

  const goods: GoodsItem[] = [
    {
      id: nid(),
      invoice: "INV-260901-01",
      palletCount: 0,
      containerCount: 0,
      transport: "SEA",
      itemCode: "HX-001",
      productCode: "SP-001",
      lot: "LOT-260901-08",
      quantity: 1200,
      exportDate: today,
      status: "COMPLETED",
      note: "",
      sample: true,
      createdAt: now - 4 * 3600_000,
      updatedAt: now - 2 * 3600_000,
    },
    {
      id: nid(),
      invoice: "INV-260901-02",
      palletCount: 0,
      containerCount: 0,
      transport: "SEA",
      itemCode: "HX-002",
      productCode: "SP-002",
      lot: "LOT-260901-09",
      quantity: 760,
      exportDate: today,
      status: "MISSING",
      note: "Thiếu 40",
      sample: true,
      createdAt: now - 2 * 3600_000,
      updatedAt: now - 15 * 60_000,
    },
    {
      id: nid(),
      invoice: "INV-260901-03",
      palletCount: 0,
      containerCount: 0,
      transport: "SEA",
      itemCode: "HX-003",
      productCode: "SP-003",
      lot: "LOT-260901-10",
      quantity: 500,
      exportDate: today,
      status: "PREPARING",
      note: "",
      sample: true,
      createdAt: now - 50 * 60_000,
      updatedAt: now - 50 * 60_000,
    },
  ];
  await db.goodsItems.bulkAdd(goods);

  const lots: Lot[] = [
    {
      id: nid(),
      lotCode: "LOT-260901-08",
      invoice: "INV-260901-01",
      productCode: "SP-001",
      date: today,
      quantity: 1200,
      status: "CLOSED",
      sample: true,
      createdAt: now - 4 * 3600_000,
    },
    {
      id: nid(),
      lotCode: "LOT-260901-09",
      invoice: "INV-260901-02",
      productCode: "SP-002",
      date: today,
      quantity: 800,
      status: "OPEN",
      sample: true,
      createdAt: now - 2 * 3600_000,
    },
    {
      id: nid(),
      lotCode: "LOT-260901-10",
      invoice: "INV-260901-03",
      productCode: "SP-003",
      date: today,
      quantity: 500,
      status: "PROCESSING",
      sample: true,
      createdAt: now - 3600_000,
    },
  ];
  await db.lots.bulkAdd(lots);
  const closed = lots[0]!;
  await db.lotClosures.add({
    id: nid(),
    lotId: closed.id,
    closedBy: binh.id,
    closedAt: now - 90 * 60_000,
    note: "Đủ số lượng, ảnh đã lưu",
    photoId: null,
  });

  const ots: Overtime[] = [
    {
      id: nid(),
      employeeId: cuong.id,
      date: addDays(today, -1),
      shiftId: caM,
      startTime: "14:00",
      endTime: "16:30",
      totalMinutes: 150,
      type: "Ngày thường",
      note: "Hỗ trợ chốt lot",
      sample: true,
      createdAt: now - 20 * 3600_000,
    },
    {
      id: nid(),
      employeeId: em.id,
      date: today,
      shiftId: caM,
      startTime: "14:00",
      endTime: "15:00",
      totalMinutes: 60,
      type: "Ngày thường",
      note: "",
      sample: true,
      createdAt: now,
    },
  ];
  await db.overtimes.bulkAdd(ots);

  const amhs: Amh[] = [
    {
      id: nid(),
      employeeId: cuong.id,
      date: addDays(today, -1),
      shiftId: caM,
      hours: 10.5,
      shiftMinutes: 8 * 60,
      otMinutes: 150,
      adjustMinutes: 0,
      confirmed: true,
      status: "APPROVED",
      note: "Liên kết OT hôm qua",
      taskId: null,
      sample: true,
      createdAt: now - 20 * 3600_000,
    },
  ];
  await db.amhs.bulkAdd(amhs);

  const three: ThreeSRecord = {
    id: nid(),
    date: today,
    shiftId: caM,
    note: "Khu đóng gói",
    completedAt: null,
    sample: true,
    createdAt: now - 3 * 3600_000,
  };
  await db.threeS.add(three);
  const s3Items = [
    "Sàng lọc",
    "Sắp xếp",
    "Sạch sẽ",
    "Săn sóc / Duy trì",
    "Sẵn sàng / Kỷ luật",
    "3D",
  ];
  const s3ChecklistItems: ChecklistItem[] = s3Items.map((label, i) => ({
    id: nid(),
    checklistId: `threes-${three.id}`,
    taskId: null,
    threeSId: three.id,
    label,
    done: i < 3,
    completedAt: i < 3 ? now - 2 * 3600_000 : null,
    completedBy: i < 3 ? em.id : null,
    photoId: null,
    note: "",
    order: i + 1,
    sample: true,
  }));
  await db.checklistItems.bulkAdd(s3ChecklistItems);

  const abs: Abnormality[] = [
    {
      id: nid(),
      type: "DATA thiếu",
      description: "SP-002 thiếu 40 pcs so với invoice INV-260901-02",
      severity: "HIGH",
      detectedBy: dung.id,
      detectedAt: now - 25 * 60_000,
      handlerId: binh.id,
      deadline: now + 2 * 3600_000,
      status: "PROCESSING",
      linkedModule: "dataItems",
      linkedId: dataItems[1]!.id,
      sample: true,
      createdAt: now - 25 * 60_000,
      updatedAt: now - 10 * 60_000,
    },
    {
      id: nid(),
      type: "3S / 3D",
      description: "Góc kệ B chưa sắp xếp, thùng rỗng để dưới đất",
      severity: "MEDIUM",
      detectedBy: em.id,
      detectedAt: now - 50 * 60_000,
      handlerId: em.id,
      deadline: now + 3600_000,
      status: "NEW",
      linkedModule: "threeS",
      linkedId: three.id,
      sample: true,
      createdAt: now - 50 * 60_000,
      updatedAt: now - 50 * 60_000,
    },
  ];
  await db.abnormalities.bulkAdd(abs);

  await db.settings.put({ key: "sampleData", value: "true" });
  await db.settings.put({ key: "currentUserId", value: an.id });
}

export async function clearSampleData(db: CvpDB): Promise<void> {
  const tables = [
    db.employees,
    db.attendance,
    db.tasks,
    db.checklistItems,
    db.overtimes,
    db.amhs,
    db.dataItems,
    db.goodsItems,
    db.lots,
    db.threeS,
    db.abnormalities,
  ] as const;
  await db.transaction("rw", [...tables, db.lotClosures, db.photos, db.blobs, db.auditLogs], async () => {
    for (const table of tables) {
      await table.filter((row) => Boolean((row as { sample?: boolean }).sample)).delete();
    }
    await db.settings.put({ key: "sampleData", value: "false" });
  });
}
