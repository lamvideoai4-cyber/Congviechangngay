# Công Việc Hằng Ngày — GitHub Build

Bộ này đã có workflow GitHub Actions để tự build APK debug.
Không cần Gradle Wrapper trong repository: workflow cài Gradle 8.11.1 trên runner rồi chạy `gradle assembleDebug`.

## Upload lên GitHub bằng điện thoại
1. Tải ZIP này.
2. GitHub → New repository → đặt tên `CongViecHangNgay`.
3. Mở repository → Add file → Upload files.
4. Giải nén ZIP trước khi upload nếu giao diện GitHub không nhận cấu trúc bên trong ZIP.
5. Upload toàn bộ nội dung project, bao gồm thư mục `.github/workflows/build-apk.yml`.
6. Commit changes.
7. Vào tab Actions → workflow `Build Android APK` → Run workflow.
8. Khi chạy xong, mở workflow run → phần Artifacts → tải `CongViecHangNgay-debug-apk`.
9. Giải nén artifact và cài `app-debug.apk` trên Android.

Lưu ý: đây là APK debug để cài thử, chưa phải bản phát hành Play Store.
