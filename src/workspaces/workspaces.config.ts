/**
 * Workspace registry — 1 nơi định nghĩa mọi workspace.
 *
 * Thêm/sửa workspace = sửa file này. Sidebar, dashboard, theme, redirect,
 * và permissions đều đọc từ đây.
 */

// Nguồn DUY NHẤT của union role: users.repo (UserRole). `import type` bị xoá lúc
// biên dịch nên client import workspaces.config không kéo theo runtime users.repo.
import type { UserRole } from '@/modules/core/users/users.repo'
export type Role = UserRole

/**
 * Năng lực nghiệp vụ theo PHÒNG (không suy được từ role) — dùng để lọc menu.
 * Server tính qua `resolveNavCapabilities` (workspaces/access.ts) rồi truyền
 * vào resolveNavSections. Ví dụ: 'production.shaping' = được định hình bảng
 * chi tiết (thống kê xưởng) — tổ trưởng cùng role employee nhưng không có.
 */
export type NavCapability =
  /** Toàn cảnh điều phối — quản đốc/GĐ/Kế hoạch/Cung ứng + người xem chéo. */
  | 'production.overview'
  /** Kế hoạch SX (lộ trình + giao tổ + hạn + ưu tiên) — Trưởng phòng Kế hoạch. */
  | 'production.plan'
  /** Định hình bảng chi tiết từ BOM Kỹ thuật — Thống kê xưởng. */
  | 'production.shaping'
  /** Nhập sổ số liệu / gia công / chốt sổ — bộ phận sản xuất (thống kê). */
  | 'production.record'
  /** Thành viên tổ xưởng — thấy màn "Việc của tổ" (tổ trưởng, mobile). */
  | 'production.team'

export type NavItem = {
  href: string
  label: string
  icon: string
  /** Visible cho role nào. Bỏ trống = mọi role trong workspace này thấy. */
  roles?: readonly Role[]
  /** Ngoài role, còn cần là head của dept? Chỉ có ý nghĩa nếu roles không loại. */
  requireHead?: boolean
  /** Chỉ hiện khi user có năng lực này (lọc theo phòng, xem NavCapability). */
  capability?: NavCapability
}

export type NavSection = {
  heading: string
  items: readonly NavItem[]
}

export type WorkspaceId =
  | 'sales'
  | 'finance'
  | 'warehouse'
  | 'technical'
  | 'planning'
  | 'qc'
  | 'production'
  // Gia đình Sản xuất tách theo VAI (user chốt 07/2026): mỗi vai một workspace.
  | 'team'
  | 'stat'
  | 'prodplan'
  | 'hr'
  | 'exec'
  | 'system'

export type WorkspaceConfig = {
  id: WorkspaceId
  label: string
  short: string
  /** Route base. Home dashboard = `${route}/`. */
  route: string
  /** Tailwind color name — dùng để tô accent bar, badge, hover. */
  accent:
    | 'orange'
    | 'emerald'
    | 'amber'
    | 'sky'
    | 'violet'
    | 'slate'
    | 'red'
    | 'yellow'
    | 'zinc'
    | 'purple'
  /** 2 ký tự viết tắt hiện trong logo box. */
  logoText: string
  /** Sidebar sections. */
  sections: readonly NavSection[]
  /**
   * Đã có UI thực chưa? Chưa ready → login không redirect tự động vào đây,
   * fallback về `/` (dashboard cũ). Chuyển sang `true` khi Phase 3 build xong.
   */
  ready: boolean
  /**
   * Ẩn section "Cá nhân" (tổng quan, kế hoạch, công việc, nghỉ phép, thông báo).
   * Dùng cho System workspace — IT admin không cần các mục cá nhân trong sidebar quản trị.
   */
  hidePersonalSection?: boolean
  // openView đã BỎ (0086): xem chéo workspace giờ cần permission tường minh
  // 'workspace.view.<id>' — xem workspaces/access.ts.
}

// ── Nav "Cá nhân" chung, tự thêm ở đầu mỗi workspace ──────────────────────
// Icon là TÊN trong registry `components/workspace/nav-icons.tsx` (lucide) —
// chuỗi để serialize được qua ranh giới server→client; tên lạ ra chấm tròn.

/**
 * TẠM ẨN mục "Cá nhân" cho TOÀN BỘ workspace (yêu cầu 08/08/2026) — các trang
 * tổng quan/kế hoạch/công việc/nghỉ phép chưa đưa vào dùng, để trên sidebar chỉ
 * gây tò mò bấm nhầm. Muốn bật lại: đổi về `false` (các route vẫn sống, ai có
 * link vẫn vào được — chỉ ẩn khỏi điều hướng).
 */
export const HIDE_PERSONAL_SECTION_GLOBALLY = true

export const PERSONAL_SECTION: NavSection = {
  heading: 'Cá nhân',
  items: [
    { href: '/', label: 'Tổng quan', icon: 'home' },
    { href: '/plan', label: 'Kế hoạch', icon: 'calendar-range' },
    { href: '/tasks', label: 'Công việc', icon: 'list-todo' },
    { href: '/hr/leave/mine', label: 'Đơn nghỉ phép', icon: 'calendar-off' },
    { href: '/notifications', label: 'Thông báo', icon: 'bell' },
  ],
} as const

/**
 * Nav DÙNG CHUNG — trang không thuộc phòng nào, mọi workspace đều thấy (tự thêm
 * vào cuối sidebar như PERSONAL_SECTION). Đặt ở đây để workspace mới có ngay,
 * khỏi phải nhớ copy vào từng config.
 *
 * `/products` (hồ sơ + thư viện SP) mở cho mọi phòng xem — chỉ Kỹ thuật / Bán
 * hàng / Giám đốc sửa được (xem `src/app/(shared)` và rbac `actions.ts`).
 */
export const SHARED_SECTION: NavSection = {
  heading: 'Dùng chung',
  // Armchair — công ty làm bàn ghế ngoại thất, thư viện SP chính là ghế.
  items: [{ href: '/products', label: 'Thư viện sản phẩm', icon: 'armchair' }],
} as const

// ── Config từng workspace ─────────────────────────────────────────────────

export const WORKSPACES: Record<WorkspaceId, WorkspaceConfig> = {
  sales: {
    id: 'sales',
    label: 'Bán hàng',
    short: 'Sales',
    route: '/sales',
    accent: 'orange',
    logoText: 'SL',
    // Đã migrate sang (workspace)/sales — bật để login đưa NV Sales vào workspace.
    ready: true,
    sections: [
      {
        heading: 'Sales',
        items: [
          { href: '/sales', label: 'Trang chủ', icon: 'home' },
          { href: '/sales/customers', label: 'Khách hàng', icon: 'users' },
          { href: '/sales/quotes', label: 'Báo giá', icon: 'file-text' },
          { href: '/sales/orders', label: 'Đơn hàng', icon: 'clipboard-list' },
          // Điền đơn giá hàng loạt (14/08/2026) — 71/71 dòng đơn đang giá 0 nên
          // mọi số tiền của Sale lẫn bảng tin GĐ ra 0. Bỏ mục này khỏi nav khi
          // dữ liệu giá đã đầy; trang vẫn sống cho lần nhập đơn lớn sau.
          {
            href: '/sales/orders/gia',
            label: 'Điền đơn giá',
            icon: 'circle-dollar-sign',
          },
          { href: '/sales/lsx', label: 'Lệnh sản xuất', icon: 'factory' },
        ],
      },
      {
        heading: 'Quản lý',
        items: [
          // Đội nhóm / Báo cáo dùng chung trang quản lý (chưa có bản riêng cho Sales).
          { href: '/team', label: 'Đội nhóm', icon: 'users-round', requireHead: true },
          {
            href: '/reports/weekly',
            label: 'Báo cáo',
            icon: 'chart-column',
            roles: ['manager', 'admin'],
          },
        ],
      },
    ],
  },

  finance: {
    id: 'finance',
    label: 'Tài chính - Kế toán',
    short: 'Finance',
    route: '/finance',
    accent: 'emerald',
    logoText: 'KT',
    // Đã migrate sang (workspace)/finance.
    ready: true,
    sections: [
      {
        heading: 'Kế toán',
        items: [
          { href: '/finance', label: 'Trang chủ', icon: 'home' },
          { href: '/finance/invoices', label: 'Hoá đơn', icon: 'receipt' },
        ],
      },
      {
        heading: 'Quản lý',
        items: [
          // Dùng chung trang quản lý (chưa có bản riêng cho Finance).
          { href: '/team', label: 'Đội nhóm', icon: 'users-round', requireHead: true },
          {
            href: '/reports/weekly',
            label: 'Báo cáo',
            icon: 'chart-column',
            roles: ['manager', 'admin'],
          },
        ],
      },
    ],
  },

  warehouse: {
    id: 'warehouse',
    label: 'Kho',
    short: 'Warehouse',
    route: '/warehouse',
    accent: 'amber',
    logoText: 'KH',
    ready: true,
    sections: [
      {
        heading: 'Kho',
        items: [
          { href: '/warehouse', label: 'Trang chủ', icon: 'home' },
          { href: '/warehouse/docs', label: 'Phiếu nhập / xuất', icon: 'receipt-text' },
          { href: '/warehouse/stock', label: 'Tồn kho', icon: 'boxes' },
          { href: '/warehouse/stocktake', label: 'Kiểm kê', icon: 'clipboard-check' },
          { href: '/warehouse/materials', label: 'Danh mục vật tư', icon: 'package' },
        ],
      },
    ],
  },

  technical: {
    id: 'technical',
    label: 'Kỹ thuật',
    short: 'Technical',
    route: '/technical',
    accent: 'sky',
    logoText: 'KT',
    ready: true,
    sections: [
      {
        heading: 'Kỹ thuật',
        items: [
          { href: '/technical', label: 'Trang chủ', icon: 'home' },
          // "Thư viện sản phẩm" đã chuyển sang SHARED_SECTION (/products) —
          // mọi workspace đều có, nên bỏ ở đây để khỏi hiện hai lần.
          { href: '/technical/showroom', label: 'Mẫu showroom', icon: 'store' },
          { href: '/technical/load-cont', label: 'Tính load cont', icon: 'container' },
        ],
      },
    ],
  },

  planning: {
    id: 'planning',
    label: 'Kế hoạch - Cung ứng',
    short: 'Planning',
    route: '/planning',
    accent: 'violet',
    logoText: 'KH',
    ready: true,
    // 2 cụm việc của phòng (1 phòng ban, chưa tách quyền — xem docs/plan-supply.md):
    // Thu mua (PO/NCC) và Kế hoạch SX (tiến độ LSX, theo dõi đơn, phiếu kho).
    sections: [
      {
        heading: 'Thu mua',
        items: [
          { href: '/planning', label: 'Trang chủ', icon: 'home' },
          { href: '/planning/pos', label: 'Quản lý đơn đặt hàng', icon: 'shopping-cart' },
          { href: '/planning/materials', label: 'Vật tư & giá mua', icon: 'package' },
          { href: '/planning/suppliers', label: 'Nhà cung cấp', icon: 'truck' },
        ],
      },
      {
        // Điều phối sản xuất nằm bên workspace Sản xuất (/production — 0084).
        // Cung ứng giữ các view cần cho lập kế hoạch mua/đặt. Route /planning/*
        // re-export view dùng chung → giữ menu Cung ứng, không nhảy shell.
        heading: 'Kế hoạch sản xuất',
        // Kế hoạch SX + Định hình thuộc workspace Sản xuất (/production/plan,
        // /production/shaping — 0084): planner chuyển sang ws Sản xuất để lên
        // kế hoạch. Ở đây chỉ giữ view phục vụ mua/đặt vật tư.
        items: [
          { href: '/planning/tracking', label: 'Theo dõi đơn hàng', icon: 'route' },
          { href: '/planning/docs', label: 'Phiếu kho', icon: 'receipt-text' },
        ],
      },
    ],
  },

  qc: {
    id: 'qc',
    label: 'Kiểm soát chất lượng',
    short: 'QC',
    route: '/qc',
    accent: 'slate',
    logoText: 'QC',
    ready: false,
    sections: [
      {
        heading: 'QC',
        items: [{ href: '/qc', label: 'Trang chủ', icon: 'home' }],
      },
    ],
  },

  production: {
    id: 'production',
    label: 'Sản xuất',
    short: 'Điều hành SX',
    route: '/production',
    accent: 'red',
    logoText: 'SX',
    ready: true,
    // Workspace ĐIỀU HÀNH của quản đốc/GĐ — gia đình SX tách theo VAI (07/2026):
    // tổ ở /to, thống kê ở /thongke, kế hoạch ở /kehoach-sx. Từ đây quản đốc
    // nhảy sang 3 workspace kia qua switcher.
    sections: [
      {
        heading: 'Điều hành xưởng',
        items: [{ href: '/production', label: 'Toàn cảnh xưởng', icon: 'factory' }],
      },
    ],
  },

  team: {
    id: 'team',
    label: 'Tổ sản xuất',
    short: 'Tổ SX',
    route: '/to',
    accent: 'amber',
    logoText: 'TỔ',
    ready: true,
    // Workspace của TỔ TRƯỞNG/tổ viên (nhãn 0087) — 3 trang gọn thay 1 trang dài.
    sections: [
      {
        heading: 'Tổ của tôi',
        items: [
          { href: '/to', label: 'Việc của tổ', icon: 'hammer' },
          { href: '/to/lenh', label: 'Lệnh đang chạy', icon: 'factory' },
          { href: '/to/qua-trinh', label: 'Quá trình tổ', icon: 'history' },
        ],
      },
    ],
  },

  stat: {
    id: 'stat',
    label: 'Thống kê xưởng',
    short: 'Thống kê',
    route: '/thongke',
    accent: 'purple',
    logoText: 'TK',
    ready: true,
    // Workspace của THỐNG KÊ (nhãn 0087): sổ tập trung + định hình + gia công.
    sections: [
      {
        heading: 'Thống kê',
        items: [
          { href: '/thongke', label: 'Sổ số liệu', icon: 'notebook-pen' },
          { href: '/thongke/giao-to', label: 'Giao tổ', icon: 'arrow-right-to-line' },
          { href: '/thongke/dinh-hinh', label: 'Định hình chi tiết', icon: 'shapes' },
          {
            href: '/thongke/gia-cong',
            label: 'Gia công ngoài',
            icon: 'arrow-left-right',
          },
          { href: '/thongke/so-tong', label: 'Sổ tổng', icon: 'table' },
          { href: '/thongke/bao-cao', label: 'Báo cáo tháng', icon: 'chart-column' },
          { href: '/thongke/lenh', label: 'Lệnh đang chạy', icon: 'factory' },
        ],
      },
    ],
  },

  prodplan: {
    id: 'prodplan',
    label: 'Kế hoạch sản xuất',
    short: 'Kế hoạch SX',
    route: '/kehoach-sx',
    accent: 'violet',
    logoText: 'KS',
    ready: true,
    // Workspace của TRƯỞNG PHÒNG KẾ HOẠCH (planner): lộ trình + giao tổ + hạn.
    sections: [
      {
        heading: 'Kế hoạch',
        items: [
          { href: '/kehoach-sx', label: 'Kế hoạch sản xuất', icon: 'calendar-range' },
          { href: '/kehoach-sx/lenh', label: 'Lệnh đang chạy', icon: 'factory' },
        ],
      },
    ],
  },

  hr: {
    id: 'hr',
    label: 'Nhân sự',
    short: 'HR',
    route: '/hr',
    accent: 'yellow',
    logoText: 'HR',
    // Đã migrate sang (workspace)/hr.
    ready: true,
    sections: [
      {
        heading: 'Nhân sự',
        items: [
          { href: '/hr', label: 'Trang chủ', icon: 'home' },
          { href: '/hr/leave', label: 'Duyệt nghỉ phép', icon: 'calendar-check' },
        ],
      },
    ],
  },

  exec: {
    id: 'exec',
    label: 'Ban Giám Đốc',
    short: 'Exec',
    route: '/exec',
    accent: 'zinc',
    logoText: 'GĐ',
    ready: true,
    sections: [
      {
        heading: 'Điều hành',
        /*
         * 09/08/2026 — chủ dự án chốt: "phần của giám đốc giới hạn ở quản lý các
         * thông tin quan trọng của phòng Sale và Cung ứng".
         *
         * 14/08/2026 — chốt tiếp: việc DUY NHẤT của GĐ trên hệ thống là KÝ PHIẾU
         * (xem docs/exec-v2-ky-duyet-plan.md). Hai màn hướng về xưởng đã bị XOÁ
         * HẲN ở bước này: `/exec/ops` (tháp điều hành) và `/exec/production`
         * (tiến độ công đoạn) — rút khỏi menu từ 09/08, xưởng đã có workspace
         * riêng (/production, /thongke), giữ lại chỉ là mã chết. Cần lại thì lấy
         * từ git, đừng viết lại từ đầu.
         *
         * Ba mục còn lại dưới đây sẽ được thay bằng "Hộp ký" ở bước 3 của kế
         * hoạch — chưa đổi bây giờ để GĐ không mất đường ký đang dùng.
         */
        items: [
          // Stamp = con dấu — trang chủ khu GĐ giờ là HỘP KÝ, không phải bảng tin.
          { href: '/exec', label: 'Hộp ký', icon: 'stamp' },
          // Mục "Phê duyệt" (/exec/approvals) đã gỡ khỏi menu 14/08: Hộp ký làm
          // đúng việc đó ngay ở trang chủ, để hai danh sách cạnh nhau thì không
          // ai biết chỗ nào là chỗ đúng. Route vẫn sống và vẫn là màn thẩm định
          // sâu ("Xem kỹ" trỏ vào /exec/approvals/{lsx,po}/[id]) cho tới khi
          // bước 4 dựng lại — xem docs/exec-v2-ky-duyet-plan.md §5C.
          { href: '/exec/approvals/history', label: 'Lịch sử ký', icon: 'history' },
          { href: '/exec/luat-ky', label: 'Luật ký', icon: 'key-round' },
          // Vế BÁN: sổ đơn theo giá trị / hạn giao.
          { href: '/exec/orders', label: 'Sổ đơn hàng', icon: 'clipboard-list' },
          // Vế MUA: đơn mua theo trạng thái, quá hẹn, đọng chưa gửi, NCC.
          { href: '/exec/purchasing', label: 'Mua hàng & NCC', icon: 'shopping-cart' },
        ],
      },
    ],
  },

  system: {
    id: 'system',
    label: 'Quản trị hệ thống',
    short: 'System',
    route: '/admin',
    accent: 'purple',
    logoText: 'HT',
    ready: true,
    hidePersonalSection: true,
    sections: [
      {
        heading: 'Quản trị',
        items: [
          { href: '/admin', label: 'Tổng quan', icon: 'home', roles: ['admin'] },
          { href: '/admin/users', label: 'Người dùng', icon: 'users', roles: ['admin'] },
          {
            href: '/admin/departments',
            label: 'Phòng ban',
            icon: 'building-2',
            roles: ['admin'],
          },
          {
            href: '/admin/permissions',
            label: 'Phân quyền',
            icon: 'key-round',
            roles: ['admin'],
          },
          {
            href: '/admin/catalogs',
            label: 'Danh mục dùng chung',
            icon: 'library',
            roles: ['admin'],
          },
          // "Nguyên nhân lỗi SX" (/admin/defect-codes) đã gỡ khỏi nav: bảng
          // production_defect_codes (0067) có sẵn nhưng TRANG QUẢN LÝ CHƯA DỰNG
          // → bấm vào là 404. Thêm lại item này khi có màn thật.
          {
            href: '/admin/audit',
            label: 'Nhật ký thao tác',
            icon: 'scroll-text',
            roles: ['admin'],
          },
          {
            href: '/admin/health',
            label: 'Sức khoẻ hệ thống',
            icon: 'heart-pulse',
            roles: ['admin'],
          },
          {
            href: '/admin/settings',
            label: 'Cấu hình',
            icon: 'settings',
            roles: ['admin'],
          },
        ],
      },
    ],
  },
} as const

export const WORKSPACE_IDS = Object.keys(WORKSPACES) as readonly WorkspaceId[]

// ── Nav resolution (dùng chung sidebar desktop + drawer mobile) ────────────
function itemVisible(
  item: NavItem,
  ctx: { role: string; isHead: boolean; capabilities?: ReadonlySet<string> },
): boolean {
  if (item.roles && !item.roles.includes(ctx.role as Role)) return false
  if (item.requireHead && !ctx.isHead) return false
  if (item.capability && !ctx.capabilities?.has(item.capability)) return false
  return true
}

/**
 * Danh sách section điều hướng đã lọc theo quyền (role + head + capability).
 * Kết quả serializable — dùng được cho cả server sidebar và client drawer mobile.
 */
export function resolveNavSections(
  workspace: WorkspaceConfig,
  ctx: { role: string; isHead: boolean; capabilities?: ReadonlySet<string> },
): NavSection[] {
  return [
    ...(HIDE_PERSONAL_SECTION_GLOBALLY || workspace.hidePersonalSection
      ? []
      : [PERSONAL_SECTION]),
    ...workspace.sections.map((s) => ({
      heading: s.heading,
      items: s.items.filter((i) => itemVisible(i, ctx)),
    })),
    SHARED_SECTION,
  ].filter((s) => s.items.length > 0)
}

/**
 * Tailwind class map cho accent — dùng ở Topbar, Sidebar highlight, badge.
 * `bgSoft`/`text` kèm dark-variant vì shell dùng chúng trên nền token (bg-card
 * tự đảo sáng/tối): màu -50 trên nền tối chói như đèn pha, phải lùi về -950/40.
 */
export const ACCENT_CLASSES: Record<
  WorkspaceConfig['accent'],
  {
    bg: string
    bgSoft: string
    text: string
    border: string
    ring: string
  }
> = {
  orange: {
    bg: 'bg-orange-500',
    bgSoft: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-500',
    ring: 'ring-orange-500',
  },
  emerald: {
    bg: 'bg-emerald-500',
    bgSoft: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500',
    ring: 'ring-emerald-500',
  },
  amber: {
    bg: 'bg-amber-500',
    bgSoft: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-500',
    ring: 'ring-amber-500',
  },
  sky: {
    bg: 'bg-sky-500',
    bgSoft: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-600 dark:text-sky-400',
    border: 'border-sky-500',
    ring: 'ring-sky-500',
  },
  violet: {
    bg: 'bg-violet-500',
    bgSoft: 'bg-violet-50 dark:bg-violet-950/40',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-500',
    ring: 'ring-violet-500',
  },
  slate: {
    bg: 'bg-slate-500',
    bgSoft: 'bg-slate-100 dark:bg-slate-800/60',
    text: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-500',
    ring: 'ring-slate-500',
  },
  red: {
    bg: 'bg-red-600',
    bgSoft: 'bg-red-50 dark:bg-red-950/40',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-600',
    ring: 'ring-red-600',
  },
  yellow: {
    bg: 'bg-yellow-500',
    bgSoft: 'bg-yellow-50 dark:bg-yellow-950/40',
    text: 'text-yellow-700 dark:text-yellow-400',
    border: 'border-yellow-500',
    ring: 'ring-yellow-500',
  },
  zinc: {
    bg: 'bg-zinc-800',
    bgSoft: 'bg-zinc-100 dark:bg-zinc-800/60',
    text: 'text-zinc-800 dark:text-zinc-300',
    border: 'border-zinc-800',
    ring: 'ring-zinc-800',
  },
  purple: {
    bg: 'bg-purple-600',
    bgSoft: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-600',
    ring: 'ring-purple-600',
  },
}
