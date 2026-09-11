import * as XLSX from "xlsx";
import { SHIFT_CATALOG, catalogByCode, normalizeShiftCode } from "./shift-catalog";

export interface PersonImportRow {
  stt: string;
  sbd: string;
  name: string;
  position: string;
  phone: string;
  group: string;
  shiftCode: string;
  note: string;
}

export interface RosterImportRow {
  sbd: string;
  date: string;
  code: string;
}

export interface PersonnelWorkbook {
  people: PersonImportRow[];
  roster: RosterImportRow[];
  unknownCodes: string[];
  warnings: string[];
  year: number;
}

const NAME_KEYS = ["họ và tên", "ho va ten", "họ tên", "ho ten", "họten", "tên", "ten", "name", "hoten"];
const SBD_KEYS = ["sbd", "số báo danh", "so bao danh", "mã nv", "ma nv", "mã nhân viên", "ma nhan vien", "code", "manv"];
const POS_KEYS = ["vị trí", "vi tri", "chức danh", "chuc danh", "vị trí công việc", "vi tri cong viec", "position", "job"];
const PHONE_KEYS = ["điện thoại", "dien thoai", "sđt", "sdt", "phone", "tel", "di động", "di dong"];
const GROUP_KEYS = ["nhóm", "nhom", "tổ", "to", "group"];
const SHIFT_KEYS = ["ca mặc định", "ca mac dinh", "ca làm việc", "ca lam viec", "ca", "shift"];
const NOTE_KEYS = ["ghi chú", "ghi chu", "note", "ghichu"];
const STT_KEYS = ["stt", "số thứ tự", "so thu tu", "no"];
const DATE_KEYS = ["ngày", "ngay", "date"];
const CODE_KEYS = ["mã ca", "ma ca", "maca", "code ca"];
const SKIP_HEADERS = ["nam", "nam (*)", "lái xe", "lai xe", "lái xe fel", "lai xe fel", "fel"];

function fold(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[*()]/g, "").replace(/\s+/g, " ").trim();
}

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    const d = v.getDate();
    const m = v.getMonth() + 1;
    const y = v.getFullYear();
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

function matchKey(header: string, keys: string[]): boolean {
  const h = fold(header);
  return keys.some((k) => h === k || h.replace(/\s/g, "") === k.replace(/\s/g, ""));
}

const DATE_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const DATE_DM = /^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/;

export function parseDateHeader(raw: string, year: number): string | null {
  const s = cellStr(raw);
  if (!s) return null;
  const iso = s.match(DATE_ISO);
  if (iso) return `${iso[1]}-${iso[2]!.padStart(2, "0")}-${iso[3]!.padStart(2, "0")}`;
  const dm = s.match(DATE_DM);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]);
    let y = dm[3] ? Number(dm[3]) : year;
    if (y < 100) y += 2000;
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

function detectYear(grids: string[][][]): number {
  for (const grid of grids) for (const row of grid.slice(0, 4)) for (const c of row) {
    const m = c.match(/(20\d{2})/);
    if (m) return Number(m[1]);
  }
  return new Date().getFullYear();
}

function findHeaderRow(grid: string[][]): number {
  const max = Math.min(grid.length, 8);
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < max; i++) {
    const row = grid[i] ?? [];
    let score = 0;
    for (const cell of row) {
      if (matchKey(cell, SBD_KEYS)) score += 5;
      if (matchKey(cell, NAME_KEYS)) score += 5;
      if (matchKey(cell, POS_KEYS)) score += 2;
      if (parseDateHeader(cell, 2026)) score += 1;
    }
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return bestScore > 0 ? best : 0;
}

function mapCols(headers: string[]) {
  const idx = { sbd: -1, name: -1, position: -1, phone: -1, group: -1, shift: -1, note: -1, stt: -1, date: -1, code: -1, dates: [] as { i: number; iso: string }[] };
  headers.forEach((h, i) => {
    if (matchKey(h, SKIP_HEADERS)) return;
    if (idx.sbd < 0 && matchKey(h, SBD_KEYS)) idx.sbd = i;
    else if (idx.name < 0 && matchKey(h, NAME_KEYS)) idx.name = i;
    else if (idx.position < 0 && matchKey(h, POS_KEYS)) idx.position = i;
    else if (idx.phone < 0 && matchKey(h, PHONE_KEYS)) idx.phone = i;
    else if (idx.group < 0 && matchKey(h, GROUP_KEYS)) idx.group = i;
    else if (idx.shift < 0 && matchKey(h, SHIFT_KEYS)) idx.shift = i;
    else if (idx.note < 0 && matchKey(h, NOTE_KEYS)) idx.note = i;
    else if (idx.stt < 0 && matchKey(h, STT_KEYS)) idx.stt = i;
    else if (idx.date < 0 && matchKey(h, DATE_KEYS)) idx.date = i;
    else if (idx.code < 0 && matchKey(h, CODE_KEYS)) idx.code = i;
  });
  return idx;
}

function padSbd(raw: string): string {
  const s = raw.trim();
  if (/^\d+$/.test(s) && s.length < 5) return s.padStart(5, "0");
  return s;
}

function parseGrid(grid: string[][], year: number, into: PersonnelWorkbook): void {
  if (grid.length === 0) return;
  const headerIndex = findHeaderRow(grid);
  const headers = grid[headerIndex] ?? [];
  const cols = mapCols(headers);
  headers.forEach((h, i) => {
    if (matchKey(h, SKIP_HEADERS)) return;
    if ([cols.sbd, cols.name, cols.position, cols.phone, cols.group, cols.shift, cols.note, cols.stt, cols.date, cols.code].includes(i)) return;
    const iso = parseDateHeader(h, year);
    if (iso) cols.dates.push({ i, iso });
  });
  const isRosterTall = cols.sbd >= 0 && cols.date >= 0 && cols.code >= 0 && cols.name < 0;
  const isPeople = cols.sbd >= 0 || cols.name >= 0;
  if (!isPeople && !isRosterTall) return;
  for (let r = headerIndex + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const sbd = padSbd(cols.sbd >= 0 ? cellStr(row[cols.sbd]) : "");
    const name = cols.name >= 0 ? cellStr(row[cols.name]) : "";
    if (!sbd && !name) continue;
    if (/^stt$/i.test(sbd) || fold(name) === "ho va ten") continue;
    if (isRosterTall) {
      const date = parseDateHeader(cellStr(row[cols.date]), year);
      const code = normalizeShiftCode(cellStr(row[cols.code]));
      if (sbd && date && code) { into.roster.push({ sbd, date, code }); if (!catalogByCode(code)) into.unknownCodes.push(code); }
      continue;
    }
    const shiftRaw = cols.shift >= 0 ? cellStr(row[cols.shift]) : "";
    const shiftCode = shiftRaw ? normalizeShiftCode(shiftRaw.split(/\s/)[0] ?? "") : "";
    if (name || sbd) {
      into.people.push({ stt: cols.stt >= 0 ? cellStr(row[cols.stt]) : "", sbd: sbd || name, name: name || sbd, position: cols.position >= 0 ? cellStr(row[cols.position]) : "", phone: cols.phone >= 0 ? cellStr(row[cols.phone]) : "", group: cols.group >= 0 ? cellStr(row[cols.group]) : "", shiftCode, note: cols.note >= 0 ? cellStr(row[cols.note]) : "" });
      if (shiftCode && !catalogByCode(shiftCode)) into.unknownCodes.push(shiftCode);
    }
    if (sbd && cols.dates.length) for (const d of cols.dates) {
      const code = normalizeShiftCode(cellStr(row[d.i]));
      if (!code) continue;
      into.roster.push({ sbd, date: d.iso, code });
      if (!catalogByCode(code)) into.unknownCodes.push(code);
    }
  }
}

export function parseCsv(text: string, year?: number): PersonnelWorkbook { const wb = XLSX.read(text, { type: "string", raw: false }); return parseWorkbook(wb, year); }
export function parseExcelBuffer(data: ArrayBuffer, year?: number): PersonnelWorkbook { const wb = XLSX.read(data, { type: "array", cellDates: true, raw: false }); return parseWorkbook(wb, year); }

function sheetToGrid(ws: XLSX.WorkSheet): string[][] {
  const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(ws, { header: 1, raw: false, defval: "", blankrows: false });
  return rows.map((row) => (row ?? []).map((c) => cellStr(c)));
}

function parseWorkbook(wb: XLSX.WorkBook, yearHint?: number): PersonnelWorkbook {
  const grids = wb.SheetNames.map((n) => sheetToGrid(wb.Sheets[n]!));
  const year = yearHint ?? detectYear(grids);
  const into: PersonnelWorkbook = { people: [], roster: [], unknownCodes: [], warnings: [], year };
  for (const grid of grids) parseGrid(grid, year, into);
  const seenPeople = new Map<string, PersonImportRow>();
  for (const p of into.people) {
    const key = p.sbd || p.name;
    const prev = seenPeople.get(key);
    if (prev) seenPeople.set(key, { ...prev, ...p, name: p.name || prev.name, position: p.position || prev.position, phone: p.phone || prev.phone });
    else seenPeople.set(key, p);
  }
  into.people = [...seenPeople.values()];
  into.unknownCodes = [...new Set(into.unknownCodes.filter(Boolean))];
  if (into.people.length === 0) into.warnings.push("Không thấy cột SBD / Họ và tên.");
  return into;
}

export function buildPersonnelTemplate(): Blob {
  const peopleHeader = ["STT", "SBD", "Họ và Tên", "Vị trí", "Điện thoại", "Nhóm", "Ca mặc định", "Ghi chú"];
  const peopleRows = [peopleHeader, ["1", "00001", "Nguyễn Văn An", "Leader", "0900000001", "Tổ thành phẩm E", "M", "Ví dụ — xóa khi nhập ca thật"], ["2", "00002", "Trần Thị Bình", "Đóng Cont,IGHS", "0900000002", "Tổ thành phẩm E", "X", ""], ["3", "00003", "Lê Văn Cường", "Lái Xe,IGHS", "0900000003", "Tổ thành phẩm E", "A", ""], ["4", "00004", "Phạm Thị Dung", "Cấp,nhận hàng", "0900000004", "Tổ thành phẩm E", "D", "Ca đêm"]];
  const today = new Date(); const y = today.getFullYear(); const m = today.getMonth() + 1; const dateHeaders: string[] = []; const dates: string[] = [];
  for (let d = 1; d <= 7; d++) { dateHeaders.push(`${d}/${m}`); dates.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`); }
  const wideHeader = ["STT", "SBD", "Họ và Tên", "Vị trí", "Điện thoại", ...dateHeaders];
  const wide = [[`Lịch làm việc tổ thành phẩm E ${y}`], wideHeader, ["1", "00001", "Nguyễn Văn An", "Leader", "0900000001", "M", "M", "M", "P", "M", "M", "M"], ["2", "00002", "Trần Thị Bình", "Đóng Cont,IGHS", "0900000002", "X", "X", "X", "S", "X", "X", "X"], ["3", "00003", "Lê Văn Cường", "Lái Xe,IGHS", "0900000003", "A", "A", "A", "SA", "A", "A", "A"], ["4", "00004", "Phạm Thị Dung", "Cấp,nhận hàng", "0900000004", "D", "D", "D", "E", "D", "D", "O"]];
  const codes = [["Mã", "Tên", "Bắt đầu", "Kết thúc", "Loại", "Giờ ca", "Dùng cho"], ...SHIFT_CATALOG.map((s) => [s.code, s.label, s.startTime, s.endTime, s.kind === "WORK" ? "Làm" : "Nghỉ", s.plannedMinutes / 60, s.kind === "WORK" ? "Chấm công / AMH" : "Khai ca nghỉ"])];
  const guide = [["Hướng dẫn nhập nhanh nhân sự + lịch ca"], [""], ["1. Sheet Nhân sự: mỗi dòng một người. SBD là khóa (trùng SBD thì cập nhật)."], ["2. Sheet Lịch ngang: giống file Excel tổ — cột ngày 1/7, 2/7… ô chứa mã ca M, X, A, D, P, O…"], ["3. Để trống ô ngày = chưa xếp ca ngày đó."], ["4. Ca làm: M 06:00–14:00 (8h), M1 06:00–15:00 (9h), X5 07:00–16:00 (9h), X 08:00–17:00 (9h), X3 09:00–18:00 (9h), A 14:00–22:00 (8h), D 22:00–06:00 (8h, qua ngày)."], ["5. Nghỉ: SM/SM1/S/SA/E = ngày nghỉ theo khung ca; P phép; CK nghĩa vụ; RO không lý do; TS thai sản; O ốm."], ["6. Chấm công: tích Đã đến. Đến sau giờ bắt đầu ca → ghi phút muộn."], ["7. AMH = giờ ca đã xác nhận + OT đã xác nhận + điều chỉnh đã duyệt."], ["8. OT là làm thêm ngoài giờ ca."], ["9. Không điền số điện thoại thật vào file mẫu này — thay bằng dữ liệu tổ."], [""], ["Có thể nhập file lịch hiện tại (.xlsx) nếu có cột SBD và Họ và Tên."], [`Các cột ngày không ghi năm sẽ lấy năm ${y} (đổi năm ở dòng tiêu đề).`], ...dates.map((d, i) => [`Cột ${dateHeaders[i]} = ${d}`])];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(peopleRows), "Nhân sự"); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wide), "Lịch ngang"); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(codes), "Mã ca"); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(guide), "Hướng dẫn");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export interface AttendanceExportRow { date: string; sbd: string; name: string; position: string; shift: string; shiftTime: string; status: string; checkIn: string; checkOut: string; lateMinutes: number; otMinutes: number; workHours: number; note: string; }
export interface OvertimeExportRow { date: string; sbd: string; name: string; position: string; startTime: string; endTime: string; totalHours: number; type: string; note: string; }

export function downloadAttendanceExcel(attendanceRows: AttendanceExportRow[], overtimeRows: OvertimeExportRow[], periodLabel: string): void {
  const wb = XLSX.utils.book_new();
  const attendanceHeader = ["Ngày", "SBD", "Họ và Tên", "Vị trí", "Ca", "Giờ ca", "Trạng thái", "Chấm vào", "Chấm ra", "Muộn (phút)", "OT (phút)", "Công (giờ)", "Ghi chú"];
  const attendanceData = attendanceRows.map((r) => [r.date, r.sbd, r.name, r.position, r.shift, r.shiftTime, r.status, r.checkIn, r.checkOut, r.lateMinutes, r.otMinutes, r.workHours, r.note]);
  const wsAttendance = XLSX.utils.aoa_to_sheet([[`BẢNG CÔNG — ${periodLabel}`], attendanceHeader, ...attendanceData]);
  wsAttendance["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 24 }, { wch: 22 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsAttendance, "Bảng công");

  const summary = new Map<string, { sbd: string; name: string; position: string; workDays: number; leaveDays: number; lateMinutes: number; otMinutes: number; workHours: number }>();
  for (const r of attendanceRows) {
    const key = r.sbd || r.name;
    const x = summary.get(key) ?? { sbd: r.sbd, name: r.name, position: r.position, workDays: 0, leaveDays: 0, lateMinutes: 0, otMinutes: 0, workHours: 0 };
    if (r.status === "Nghỉ") x.leaveDays += 1; else if (r.shift) x.workDays += 1;
    x.lateMinutes += r.lateMinutes; x.otMinutes += r.otMinutes; x.workHours += r.workHours; summary.set(key, x);
  }
  const wsSummary = XLSX.utils.aoa_to_sheet([[`TỔNG HỢP CÔNG — ${periodLabel}`], ["SBD", "Họ và Tên", "Vị trí", "Ngày làm", "Ngày nghỉ", "Muộn (phút)", "OT (phút)", "Tổng công (giờ)"], ...[...summary.values()].map((r) => [r.sbd, r.name, r.position, r.workDays, r.leaveDays, r.lateMinutes, r.otMinutes, Math.round(r.workHours * 100) / 100])]);
  wsSummary["!cols"] = [{ wch: 10 }, { wch: 24 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Tổng hợp");

  const wsOt = XLSX.utils.aoa_to_sheet([[`BẢNG OT — ${periodLabel}`], ["Ngày", "SBD", "Họ và Tên", "Vị trí", "Bắt đầu", "Kết thúc", "OT (giờ)", "Loại", "Ghi chú"], ...overtimeRows.map((r) => [r.date, r.sbd, r.name, r.position, r.startTime, r.endTime, r.totalHours, r.type, r.note])]);
  wsOt["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 24 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsOt, "OT");

  const safe = periodLabel.replace(/[^0-9A-Za-zÀ-ỹ _-]+/g, "-").replace(/\s+/g, "-");
  XLSX.writeFile(wb, `bang-cong-ot-${safe}.xlsx`);
}

export const TEMPLATE_FILENAME = "mau-nhap-nhan-su-congviecpro.xlsx";
