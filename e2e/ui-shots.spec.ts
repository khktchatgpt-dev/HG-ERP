import { expect, test, type Page } from '@playwright/test'

/**
 * BỘ ẢNH CHUẨN GIAO DIỆN — xem `playwright.config.ts`.
 *
 * Hai nhóm:
 *  · MÀN THẬT dựng bằng dữ liệu đóng băng (`/design-lab/chup/<màn>`) — chụp
 *    đúng khung 1280×800 của màn;
 *  · TRANG MẪU của sổ thiết kế (`/design-lab/mau-*`) — sáu khuôn màn dựng toàn
 *    bằng kit: sửa kit mà khuôn đổi hình là thấy ngay.
 *
 * Đồng hồ cố định ngày dữ liệu được đóng băng: màn tính "đã chờ N ngày", "qua
 * N ng" theo hôm nay — không cố định thì ảnh đổi mỗi ngày.
 */
const NGAY = new Date('2026-09-28T09:00:00+07:00')

async function mo(page: Page, url: string) {
  await page.clock.setFixedTime(NGAY)
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  // Nút "N" của Next.js dev đè lên góc màn — không thuộc giao diện.
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  await page.evaluate(() => document.fonts.ready)
}

const MAN_THAT = ['hop-ky', 'giam-sat', 'don-mua'] as const
for (const man of MAN_THAT) {
  test(`màn thật · ${man}`, async ({ page }) => {
    await mo(page, `/design-lab/chup/${man}`)
    await expect(page.locator(`[data-chup="${man}"]`)).toHaveScreenshot(`man-${man}.png`)
  })
}

const MAU = [
  'mau-vao-viec',
  'mau-hop-thu',
  'mau-danh-sach',
  'mau-erp',
  'mau-ho-so-ncc',
  'mau-soan-don',
] as const
for (const mau of MAU) {
  test(`khuôn mẫu · ${mau}`, async ({ page }) => {
    await mo(page, `/design-lab/${mau}`)
    await expect(page).toHaveScreenshot(`${mau}.png`)
  })
}
