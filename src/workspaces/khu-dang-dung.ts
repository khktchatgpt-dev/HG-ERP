import { WORKSPACES, type WorkspaceConfig, type WorkspaceId } from './workspaces.config'

/**
 * KHU ĐANG ĐỨNG — workspace người dùng vừa đi qua, để trang DÙNG CHUNG (khu lương, hồ sơ
 * SP…) giữ đúng sidebar thay vì nhảy về khu NHÀ (21/10/2026: quản trị viên đang ở Tài
 * chính bấm "Hồ sơ lương" bị quăng sang sidebar Quản trị hệ thống).
 *
 * `proxy.ts` ghi cookie mỗi khi người dùng mở một trang thuộc một workspace; layout trang
 * dùng chung đọc lại. File này KHÔNG chạm DB để chạy được trong proxy (Edge).
 */
export const COOKIE_KHU = 'ws_dang'

/** Đường dẫn → workspace sở hữu nó (theo `route` + `altRoutes`), không thuộc khu nào → null. */
export function khuTheoDuongDan(pathname: string): WorkspaceConfig | null {
  // Tiền tố DÀI NHẤT thắng (10/11/2026): khu `thongke` sở hữu `/thongke/ghi`
  // trong khi `production` giữ `/thongke` (altRoute gộp ba khu 18/09/2026) —
  // không so dài thì mọi trang ghi sổ rơi về khu Sản xuất.
  let best: WorkspaceConfig | null = null
  let bestLen = -1
  for (const ws of Object.values(WORKSPACES)) {
    for (const base of [ws.route, ...(ws.altRoutes ?? [])]) {
      if (
        (pathname === base || pathname.startsWith(base + '/')) &&
        base.length > bestLen
      ) {
        best = ws
        bestLen = base.length
      }
    }
  }
  return best
}

/** Giá trị cookie → workspace (bỏ qua giá trị lạ). */
export function khuTuCookie(v: string | undefined): WorkspaceConfig | null {
  return v && v in WORKSPACES ? WORKSPACES[v as WorkspaceId] : null
}

/** Sidebar của khu có mục trỏ tới `href` không (khu lương chỉ giữ khu có mục lương). */
export function khuCoMuc(ws: WorkspaceConfig, href: string): boolean {
  return ws.sections.some((s) => s.items.some((i) => i.href === href))
}

/**
 * GIA ĐÌNH Sản xuất — ba bề mặt (production · team · thongke, 10/11/2026) vào
 * lẫn nhau và dùng chung nhiều trang. Khai ở đây (không DB) để proxy Edge và
 * access.ts cùng đọc MỘT nguồn.
 */
export const GIA_DINH_SX: ReadonlySet<WorkspaceId> = new Set([
  'production',
  'team',
  'thongke',
])

/**
 * Trang DÙNG CHUNG của gia đình SX: thống kê và quản đốc đều mở, sidebar phải
 * giữ khu người đó đang đứng chứ không nhảy theo chủ sở hữu tiền tố (`/thongke`
 * là altRoute của production nên Lệnh SX sẽ kéo thống kê về sidebar Sản xuất).
 */
const TRANG_CHUNG_SX = [
  '/thongke/lenh',
  '/thongke/lsx',
  '/thongke/lo-trinh',
  '/thongke/bao-cao',
]

/**
 * Khu nào cần ghi vào cookie khi mở `pathname`, hay null = giữ cookie cũ.
 * Giữ khi: trang không thuộc khu nào; cookie đã đúng; hoặc trang dùng chung SX
 * mà người xem đang đứng ở một khu cùng gia đình.
 */
export function khuGhiCookie(
  pathname: string,
  cookieCu: string | undefined,
): WorkspaceId | null {
  const ws = khuTheoDuongDan(pathname)
  if (!ws) return null
  if (cookieCu === ws.id) return null
  const cu = khuTuCookie(cookieCu)
  if (
    cu &&
    GIA_DINH_SX.has(cu.id) &&
    GIA_DINH_SX.has(ws.id) &&
    TRANG_CHUNG_SX.some((b) => pathname === b || pathname.startsWith(b + '/'))
  )
    return null
  return ws.id
}
