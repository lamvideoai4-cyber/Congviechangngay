# Changelog

## v1.0.0 — 2026-09-01

### Feature
- Kiến trúc offline-first: IndexedDB (Dexie) tương đương Room, mọi nghiệp vụ ghi thật.
- Dashboard ca hiện tại, việc chưa xong, nhật ký ca, bàn giao ca.
- Nhân sự / nhóm / 4 ca (Ca 4 qua ngày) / chấm công vào-ra-nghỉ.
- Công việc, khối tùy biến, checklist, tiến độ slider, lịch sử audit, ảnh.
- OT / AMH tự tính giờ, gồm OT qua 00:00.
- DATA, hàng xuất, Lot, chốt Lot (không xóa lịch sử chốt).
- Quét QR/Barcode camera thật, tạo mới nếu chưa có mã.
- 3S/3D, bất thường, mail intent, báo cáo + biểu đồ.
- Backup ZIP (manifest + json + ảnh), preview, ghi đè / hợp nhất / bỏ trùng, auto-backup trước restore, chia sẻ.
- Phân quyền ADMIN / LEADER / USER / VIEWER trên máy.
- Dữ liệu mẫu lần đầu chạy, có nút xóa mẫu.
- Nhắc việc nền (deadline, DATA, Lot).

### Files
- `src/lib/cvp/*` domain + database + backup
- `src/routes/*` toàn bộ module
- `src/components/*` shell + camera + QR
- `.github/workflows/build.yml`

### Tests
- Ca đêm / OT qua ngày: 22:00→06:00, 22:00→01:00, 23:30→02:30
- Progress 100% → COMPLETED
- Duplicate detection
- Lot closing guards

### Database
- Schema version 1 (Dexie). Nâng cấp sau này dùng `db.version(n).stores(...)`, không xóa DB khi update.

### Bug fixed
- (initial release)
