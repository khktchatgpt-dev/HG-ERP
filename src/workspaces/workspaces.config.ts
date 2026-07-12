/**
 * Workspace registry — 1 nơi định nghĩa mọi workspace.
 *
 * Thêm/sửa workspace = sửa file này. Sidebar, dashboard, theme, redirect,
 * và permissions đều đọc từ đây.
 */

export type Role = 'admin' | 'manager' | 'employee'

export type NavItem = {
  href: string
  label: string
  icon: string
  /** Visible cho role nào. Bỏ trống = mọi role trong workspace này thấy. */
  roles?: readonly Role[]
  /** Ngoài role, còn cần là head của dept? Chỉ có ý nghĩa nếu roles không loại. */
  requireHead?: boolean
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
}

// ── Nav "Cá nhân" chung, tự thêm ở đầu mỗi workspace ──────────────────────
export const PERSONAL_SECTION: NavSection = {
  heading: 'Cá nhân',
  items: [
    { href: '/', label: 'Tổng quan', icon: '◧' },
    { href: '/plan', label: 'Kế hoạch', icon: '☷' },
    { href: '/tasks', label: 'Công việc', icon: '◐' },
    { href: '/hr/leave/mine', label: 'Đơn nghỉ phép', icon: '☰' },
    { href: '/notifications', label: 'Thông báo', icon: '◔' },
  ],
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
          { href: '/sales', label: 'Trang chủ', icon: '◧' },
          { href: '/sales/customers', label: 'Khách hàng', icon: '◍' },
          { href: '/sales/quotes', label: 'Báo giá', icon: '▤' },
          { href: '/sales/orders', label: 'Đơn hàng', icon: '◫' },
          { href: '/sales/tracking', label: 'Theo dõi đơn', icon: '◎' },
        ],
      },
      {
        heading: 'Quản lý',
        items: [
          // Đội nhóm / Báo cáo dùng chung trang quản lý (chưa có bản riêng cho Sales).
          { href: '/team', label: 'Đội nhóm', icon: '◑', requireHead: true },
          {
            href: '/reports/weekly',
            label: 'Báo cáo',
            icon: '☰',
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
          { href: '/finance', label: 'Trang chủ', icon: '◧' },
          { href: '/finance/invoices', label: 'Hoá đơn', icon: '₫' },
        ],
      },
      {
        heading: 'Quản lý',
        items: [
          // Dùng chung trang quản lý (chưa có bản riêng cho Finance).
          { href: '/team', label: 'Đội nhóm', icon: '◑', requireHead: true },
          {
            href: '/reports/weekly',
            label: 'Báo cáo',
            icon: '☰',
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
          { href: '/warehouse', label: 'Trang chủ', icon: '◧' },
          { href: '/warehouse/docs', label: 'Phiếu nhập / xuất', icon: '▥' },
          { href: '/warehouse/stock', label: 'Tồn kho', icon: '▦' },
          { href: '/warehouse/materials', label: 'Danh mục vật tư', icon: '▤' },
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
          { href: '/technical', label: 'Trang chủ', icon: '◧' },
          { href: '/technical/products', label: 'Thư viện sản phẩm', icon: '◇' },
          { href: '/technical/load-cont', label: 'Tính load cont', icon: '▣' },
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
          { href: '/planning', label: 'Trang chủ', icon: '◧' },
          { href: '/planning/pos', label: 'Đơn đặt vật tư', icon: '▩' },
          { href: '/planning/suppliers', label: 'Nhà cung cấp', icon: '◒' },
        ],
      },
      {
        heading: 'Kế hoạch sản xuất',
        items: [
          { href: '/planning/production', label: 'Tiến độ sản xuất', icon: '▣' },
          // Route /planning/* re-export view dùng chung → giữ menu Cung ứng, không
          // nhảy sang shell Sản xuất/Sales/Kho.
          { href: '/planning/board', label: 'Bảng tổng tiến độ', icon: '▦' },
          { href: '/planning/tracking', label: 'Theo dõi đơn hàng', icon: '◎' },
          { href: '/planning/docs', label: 'Phiếu kho', icon: '▥' },
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
        items: [{ href: '/qc', label: 'Trang chủ', icon: '◧' }],
      },
    ],
  },

  production: {
    id: 'production',
    label: 'Sản xuất',
    short: 'Production',
    route: '/production',
    accent: 'red',
    logoText: 'SX',
    ready: true,
    sections: [
      {
        // Phạm vi xưởng gọn trong /production (gate /sales không mở cho xưởng —
        // commit "xem chéo đúng phạm vi"). Cần nhìn toàn cảnh đơn → nới sau.
        heading: 'Sản xuất',
        items: [
          { href: '/production', label: 'Lệnh đang chạy', icon: '◧' },
          { href: '/production/board', label: 'Bảng tổng tiến độ', icon: '▦' },
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
          { href: '/hr', label: 'Trang chủ', icon: '◧' },
          { href: '/hr/leave', label: 'Duyệt nghỉ phép', icon: '✓' },
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
        items: [
          { href: '/exec', label: 'Phê duyệt', icon: '✓' },
          // Route /exec/* riêng → giữ menu Ban GĐ, không nhảy sang shell Sales.
          { href: '/exec/tracking', label: 'Theo dõi đơn hàng', icon: '◎' },
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
          { href: '/admin', label: 'Tổng quan', icon: '◧', roles: ['admin'] },
          { href: '/admin/users', label: 'Người dùng', icon: '◍', roles: ['admin'] },
          { href: '/admin/departments', label: 'Phòng ban', icon: '◑', roles: ['admin'] },
          {
            href: '/admin/catalogs',
            label: 'Danh mục dùng chung',
            icon: '▤',
            roles: ['admin'],
          },
          {
            href: '/admin/audit',
            label: 'Nhật ký thao tác',
            icon: '☰',
            roles: ['admin'],
          },
          {
            href: '/admin/health',
            label: 'Sức khoẻ hệ thống',
            icon: '♥',
            roles: ['admin'],
          },
          { href: '/admin/settings', label: 'Cấu hình', icon: '⚙', roles: ['admin'] },
        ],
      },
    ],
  },
} as const

export const WORKSPACE_IDS = Object.keys(WORKSPACES) as readonly WorkspaceId[]

// ── Nav resolution (dùng chung sidebar desktop + drawer mobile) ────────────
function itemVisible(item: NavItem, ctx: { role: string; isHead: boolean }): boolean {
  if (item.roles && !item.roles.includes(ctx.role as Role)) return false
  if (item.requireHead && !ctx.isHead) return false
  return true
}

/**
 * Danh sách section điều hướng đã lọc theo quyền (role + head). Kết quả
 * serializable — dùng được cho cả server sidebar và client drawer mobile.
 */
export function resolveNavSections(
  workspace: WorkspaceConfig,
  ctx: { role: string; isHead: boolean },
): NavSection[] {
  return [
    ...(workspace.hidePersonalSection ? [] : [PERSONAL_SECTION]),
    ...workspace.sections.map((s) => ({
      heading: s.heading,
      items: s.items.filter((i) => itemVisible(i, ctx)),
    })),
  ].filter((s) => s.items.length > 0)
}

/** Tailwind class map cho accent — dùng ở Topbar, Sidebar highlight, badge. */
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
    bgSoft: 'bg-orange-50',
    text: 'text-orange-600',
    border: 'border-orange-500',
    ring: 'ring-orange-500',
  },
  emerald: {
    bg: 'bg-emerald-500',
    bgSoft: 'bg-emerald-50',
    text: 'text-emerald-600',
    border: 'border-emerald-500',
    ring: 'ring-emerald-500',
  },
  amber: {
    bg: 'bg-amber-500',
    bgSoft: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-500',
    ring: 'ring-amber-500',
  },
  sky: {
    bg: 'bg-sky-500',
    bgSoft: 'bg-sky-50',
    text: 'text-sky-600',
    border: 'border-sky-500',
    ring: 'ring-sky-500',
  },
  violet: {
    bg: 'bg-violet-500',
    bgSoft: 'bg-violet-50',
    text: 'text-violet-600',
    border: 'border-violet-500',
    ring: 'ring-violet-500',
  },
  slate: {
    bg: 'bg-slate-500',
    bgSoft: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-500',
    ring: 'ring-slate-500',
  },
  red: {
    bg: 'bg-red-600',
    bgSoft: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-600',
    ring: 'ring-red-600',
  },
  yellow: {
    bg: 'bg-yellow-500',
    bgSoft: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-500',
    ring: 'ring-yellow-500',
  },
  zinc: {
    bg: 'bg-zinc-800',
    bgSoft: 'bg-zinc-100',
    text: 'text-zinc-800',
    border: 'border-zinc-800',
    ring: 'ring-zinc-800',
  },
  purple: {
    bg: 'bg-purple-600',
    bgSoft: 'bg-purple-50',
    text: 'text-purple-600',
    border: 'border-purple-600',
    ring: 'ring-purple-600',
  },
}
