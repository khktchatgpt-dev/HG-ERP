import { defineConfig, devices } from '@playwright/test'

/**
 * CHỤP MÀN SO ẢNH CHUẨN (28/09/2026 — bước 2 kế hoạch chất lượng UI).
 *
 *   npm run ui:shots          # chụp và so với ảnh chuẩn — lệch là đỏ
 *   npm run ui:shots:update   # chấp nhận hình mới làm ảnh chuẩn (sau khi đã NHÌN)
 *
 * Vì sao cần: test Vitest kiểm logic + a11y, KHÔNG nhìn hình. Lỗi bố cục (bảng
 * xẹp 17px, bảng cuộn ngang, chữ mất cỡ vì cn/tailwind-merge) chỉ lộ khi có
 * người mở màn ra xem. Ảnh chuẩn nằm trong repo: sửa kit mà một màn đổi hình
 * là thấy ngay, kèm ảnh khác biệt trong `test-results/`.
 *
 * Chạy trên dev server đang chạy ở :3000 (hoặc tự bật `npm run dev`). Chỉ chụp
 * trang PUBLIC trong /design-lab — không cần đăng nhập, dữ liệu cố định.
 */
export default defineConfig({
  testDir: 'e2e',
  snapshotPathTemplate: 'e2e/__anh-chuan__/{arg}{ext}',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 90_000,
  expect: {
    toHaveScreenshot: {
      /*
        TRẦN 20 ĐIỂM ẢNH, không phải tỉ lệ. Bản đầu đặt 1% (≈10.000 điểm ảnh ở
        1280×800) và thử lại thì HỎNG IM LẶNG: đổi "Chờ ký 16" thành "99" chỉ
        lệch vài trăm điểm ảnh — test vẫn xanh. Chụp cùng máy, cùng trình duyệt
        thì hai lần chạy khớp gần như tuyệt đối; 20 điểm ảnh chừa cho khử răng cưa.
      */
      maxDiffPixels: 20,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/design-lab',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
