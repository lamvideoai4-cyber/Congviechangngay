# CongViecPro – GitHub APK build

Dự án đã được thêm Android wrapper để GitHub Actions tạo APK cài trực tiếp trên Android.

## Cách dùng

1. Đưa source lên GitHub.
2. Vào **Settings → Secrets and variables → Actions → Variables**.
3. Tạo Repository variable:
   - **Name:** `APP_URL`
   - **Value:** URL CongViecPro đã deploy, ví dụ `https://ten-app-cua-ban.vercel.app`
4. Push vào `main` hoặc `master`.
5. Vào tab **Actions → Build Web + Android APK**.
6. Sau khi chạy xong, tải artifact **congviecpro-android-apk** và lấy `app-debug.apk`.

APK này là Android WebView wrapper, nên phần web/SSR, đăng nhập và dữ liệu vẫn chạy trên server đã deploy. `APP_URL` phải là URL HTTPS truy cập được từ điện thoại.

> Không đặt mật khẩu, API key hoặc token vào `APP_URL`. Đây chỉ là URL public của ứng dụng.
