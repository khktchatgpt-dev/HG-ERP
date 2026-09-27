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

/*
  API TRONG TRANG CHỤP: trang chụp không có phiên đăng nhập — một màn tự gọi API
  lúc mở (vd. Tài liệu của đơn gọi /api/files) sẽ nhận 401 và `api()` đá sang
  /login, mất cả khung chụp. Trả dữ liệu RỖNG đúng dạng cho các đường đã biết;
  đường lạ trả {} và được GHI LẠI để test báo — thêm dạng của nó vào đây.
*/
// Regex viết bằng String.raw — dấu `\` trong regex từng bị công cụ ghi file nuốt mất.
const API_RONG: [RegExp, unknown][] = [
  [new RegExp(String.raw`/api/files\?`), { files: [] }],
]
async function chanApi(page: Page, la: string[]) {
  await page.route('**/api/**', (route) => {
    const u = route.request().url()
    const hit = API_RONG.find(([re]) => re.test(u))
    if (!hit) la.push(u)
    return route.fulfill({ json: hit ? hit[1] : {} })
  })
}

async function mo(page: Page, url: string) {
  await page.clock.setFixedTime(NGAY)
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  // Nút "N" của Next.js dev đè lên góc màn — không thuộc giao diện.
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  await page.evaluate(() => document.fonts.ready)
}

const MAN_THAT = [
  'hop-ky',
  'giam-sat',
  'don-mua',
  // Trang chi tiết đơn — lưới an toàn cho việc tách DonChungTuScreen (bước 3).
  'don-ct-da-gui-tong-quan',
  'don-ct-da-gui-dong-hang',
  'don-ct-da-gui-giao-nhan',
  'don-ct-da-gui-tai-chinh',
  'don-ct-da-gui-lich-su',
  'don-ct-cho-duyet-tong-quan',
  'don-ct-cho-duyet-dong-hang',
  'don-ct-ve-du-tong-quan',
  'don-ct-ve-du-giao-nhan',
] as const
for (const man of MAN_THAT) {
  test(`màn thật · ${man}`, async ({ page }) => {
    const la: string[] = []
    await chanApi(page, la)
    await mo(page, `/design-lab/chup/${man}`)
    await expect(page.locator(`[data-chup="${man}"]`)).toHaveScreenshot(`man-${man}.png`)
    expect(la, 'màn gọi API chưa khai dạng rỗng trong API_RONG').toEqual([])
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
