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
  for (const ws of Object.values(WORKSPACES)) {
    // `altRoutes` cho một workspace sở hữu nhiều gốc đường dẫn — khu Sản xuất
    // gộp ba khu cũ nên còn giữ `/thongke` và `/kehoach-sx` (18/09/2026).
    for (const base of [ws.route, ...(ws.altRoutes ?? [])]) {
      if (pathname === base || pathname.startsWith(base + '/')) return ws
    }
  }
  return null
}

/** Giá trị cookie → workspace (bỏ qua giá trị lạ). */
export function khuTuCookie(v: string | undefined): WorkspaceConfig | null {
  return v && v in WORKSPACES ? WORKSPACES[v as WorkspaceId] : null
}

/** Sidebar của khu có mục trỏ tới `href` không (khu lương chỉ giữ khu có mục lương). */
export function khuCoMuc(ws: WorkspaceConfig, href: string): boolean {
  return ws.sections.some((s) => s.items.some((i) => i.href === href))
}
