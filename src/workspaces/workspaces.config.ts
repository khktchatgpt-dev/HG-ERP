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
  /**
   * Số đếm SỐNG cạnh nhãn (vd "Chờ tôi phê duyệt · 5"). KHÔNG khai trong config
   * tĩnh — server gắn lúc render qua `withNavBadges` (xem workspaces/nav-badges).
   */
  badge?: number
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
  /**
   * CỬA VÀO — nơi người dùng rơi xuống khi BƯỚC VÀO workspace (đăng nhập, bấm
   * ở ô chuyển phòng). Mặc định là `route`.
   *
   * Tách khỏi `route` vì `route` còn là DẤU NHẬN DẠNG: `resolveWorkspaceFromPath`
   * dựa vào nó để biết một đường dẫn thuộc phòng nào (tô màu, sáng mục menu).
   * Đổi `route` để dời cửa vào là làm cả khu cũ mất danh tính. Cung ứng đang
   * cần đúng việc này: cửa vào đã sang khu Mua hàng mới, nhưng `/planning` vẫn
   * phải là Cung ứng vì nó còn phục vụ.
   */
  home?: string
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
  items: [
    { href: '/products', label: 'Thư viện sản phẩm', icon: 'armchair' },
    // Khuôn nhôm: Kỹ thuật giữ, nhưng Cung ứng tra để đặt hàng và Sản xuất tra
    // để nhận dạng cây nhôm — nên nó ở khu dùng chung, không nhốt trong /technical.
    { href: '/khuon', label: 'Khuôn nhôm', icon: 'shapes' },
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
          /*
           * CỬA VÀO công nợ là SỔ THEO KỲ, không phải ảnh chụp "tại thời điểm
           * này": chỉ sổ theo kỳ mới chốt được và lên được báo cáo tài chính.
           * Màn ghi thanh toán (`/finance/cong-no-ncc`) vào TỪ đây — cho nó một
           * mục ngang hàng là dựng hai chỗ cùng nói "công nợ" trong một phòng,
           * rồi hai chỗ ra hai con số.
           */
          {
            href: '/finance/so-cong-no',
            label: 'Công nợ NCC',
            icon: 'circle-dollar-sign',
          },
          { href: '/finance/invoices', label: 'Hoá đơn', icon: 'receipt' },
          /*
           * Điều khoản thanh toán là DANH MỤC, không phải chứng từ — nhưng nó
           * đứng riêng ở nav vì đang là chốt chặn: 0/164 NCC khai số ngày, nên
           * 6,578 tỷ công nợ không khoản nào có hạn. Khai xong hết thì mục này
           * gập vào hồ sơ NCC được.
           */
          {
            href: '/finance/dieu-khoan-ncc',
            label: 'Hạn thanh toán',
            icon: 'calendar-check',
          },
          /*
           * Đối chiếu hoá đơn ↔ đơn mua KHÔNG đứng riêng ở nav: nó là bước soi
           * chi tiết, vào từ một lệnh hoặc một đơn cụ thể. Cho nó một mục ngang
           * hàng "Hoá đơn" là dựng hai chỗ cùng nói về hoá đơn trong một phòng.
           */
          {
            href: '/finance/theo-lenh',
            label: 'Tiền theo lệnh',
            icon: 'chart-column',
          },
          {
            href: '/finance/bao-cao',
            label: 'Báo cáo mua hàng',
            icon: 'chart-pie',
          },
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
    /*
     * DỰNG LẠI TỪNG MÀN MỘT (từ 16/09/2026, `docs/kho-buoc-1-nhap-kho.md`).
     * Khu Kho bị gỡ sạch màn ngày 16/09 (commit 20033fb) sau đợt dựng 31 màn
     * trong 10 giờ mà không ai nghiệm thu giữa chừng. Lần này mỗi bước một
     * màn, chạy thật xong mới thêm mục kế: Nhập → Xuất → Tồn → Danh mục.
     *
     * `home` trỏ thẳng vào màn đầu tiên: KHÔNG dựng trang chủ khu Kho ở bước
     * này — bàn làm việc là màn phụ, dựng sau khi bốn màn chính chạy thật.
     * Mục nav chỉ có thứ ĐÃ CÓ route; để mục trỏ vào route chưa dựng là dẫn
     * người dùng vào 404.
     */
    ready: true,
    home: '/warehouse/nhap',
    sections: [
      {
        heading: 'Nghiệp vụ',
        items: [
          { href: '/warehouse/nhap', label: 'Hàng về', icon: 'arrow-down-to-line' },
          // Bước 2 (16/09/2026): xuất theo thực tế lấy, không theo định mức.
          { href: '/warehouse/xuat', label: 'Xuất kho', icon: 'arrow-up-from-line' },
          // Bước 3 (16/09/2026): tra tồn — màn hay mở nhất sau hai màn việc.
          { href: '/warehouse/ton', label: 'Tồn kho', icon: 'boxes' },
          // Hoàn thiện A1 (16/09/2026): sổ phiếu CỦA KHO. Ba màn trên từng
          // trỏ "Xem sổ phiếu" sang /planning/docs — khu Cung ứng, vỏ khác —
          // và đảo phiếu ghi sai chỉ làm được ở màn cũ.
          { href: '/warehouse/phieu', label: 'Sổ phiếu', icon: 'book-open' },
          // Bước 4 (16/09/2026): danh mục BẢN CỦA KHO — chủ dự án chốt dựng
          // lại, không mượn màn Cung ứng. Kho hỏi ĐVT · kệ · ngưỡng, người
          // mua hỏi giá · NCC; ranh giới quyền sửa đã có trong service.
          { href: '/warehouse/vat-tu', label: 'Danh mục vật tư', icon: 'package' },
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
          // Trang DÙNG CHUNG (/cat-phoi, khu (shared)) — Kỹ thuật lập quy cắt,
          // xưởng cắt theo. Không đưa vào SHARED_SECTION vì Kế toán/Nhân sự
          // không có việc gì ở đó.
          { href: '/cat-phoi', label: 'Quy cắt phôi', icon: 'scissors' },
          {
            href: '/technical/dinh-muc',
            label: 'Sức khoẻ định mức',
            icon: 'heart-pulse',
          },
        ],
      },
    ],
  },

  planning: {
    id: 'planning',
    // Đổi tên 15/08/2026: "Kế hoạch - Cung ứng" → "Cung ứng". Kế hoạch SX đã
    // tách hẳn sang workspace riêng (prodplan /kehoach-sx — 0084/0087) nên tên
    // cũ chỉ còn gây hiểu nhầm. Route /planning giữ nguyên (link/bookmark sống).
    label: 'Cung ứng',
    short: 'Cung ứng',
    route: '/planning',
    /*
      CỬA VÀO ĐÃ DỜI SANG KHU MUA HÀNG MỚI (15/09/2026).

      Đăng nhập hay bấm ô chuyển phòng giờ rơi vào `/mua-hang` — màn "Bàn làm
      việc" dựng bằng kit mới theo Khuôn A của sổ `/design-lab`. Nó là bản GỘP
      của bốn trang cũ (Tổng quan, Chờ tôi xử lý, Vấn đề, Việc cần quyết định),
      đúng như chủ dự án chốt 10/09: bốn trang cho một vai là dashboard kiểu
      web, không hệ ERP nào làm thế.

      VÌ SAO GIỜ MỚI DỜI. Ghi chú 14/09 bên dưới hoãn việc này với lý do "bảy
      trên chín mục còn là trang tạm". Đo lại 15/09: chỉ còn HAI — Yêu cầu mua
      và Hoá đơn NCC — và cả hai đều là trang nói thẳng chưa dựng cùng lý do,
      không phải trang trắng. Chủ dự án chốt tạm bỏ qua, dựng sau.

      `route` GIỮ NGUYÊN `/planning`: nó là dấu nhận dạng, không phải cửa vào.
      Khu cũ vẫn phục vụ (menu khu mới có mục "Khu Cung ứng cũ" dẫn về), và đổi
      `route` là làm mọi đường `/planning/*` mất danh tính phòng.
    */
    home: '/mua-hang',
    accent: 'violet',
    logoText: 'CƯ',
    ready: true,
    sections: [
      /*
        MỘT SIDEBAR CHO CẢ PHÒNG (16/09/2026 — chủ dự án chốt).

        Từ 14/09 phòng Cung ứng sống với HAI thanh điều hướng: sidebar này
        (240px, theme v3) khi ở `/planning/*`, và một rail 52px riêng khi ở
        `/mua-hang/*`. Hai cây menu khác nhau, hai nếp bấm khác nhau, và mục
        nào nằm ở thanh nào thì phải nhớ — chủ dự án gọi đúng tên: "lẫn lộn".

        Chốt: giữ GIAO DIỆN sidebar cũ (được chấm đẹp hơn), đổi RUỘT sang các
        màn mới. Rail 52px xoá hẳn — đường lùi là `git revert`, không phải nuôi
        song song thêm một tháng nữa.

        Trang cũ `/planning/*` VẪN SỐNG (bookmark, link trong màn khác, và mục
        "Khu Cung ứng cũ" cuối menu) — chỉ rút khỏi luồng chính. Bản đồ mục cũ →
        màn mới có test canh ở `workspaces.config.test.ts`: gỡ một màn mới mà
        quên đường thay thế thì test đỏ, chứ không phải người dùng phát hiện.
      */
      {
        heading: 'Nghiệp vụ',
        items: [
          { href: '/mua-hang', label: 'Bàn làm việc', icon: 'home' },
          // Hộp thư việc: bản mới của "Chờ tôi xử lý" — badge giữ nguyên nguồn
          // đếm (`countMyTodos`), chỉ đổi href nó bám vào.
          { href: '/mua-hang/hop-thu', label: 'Hộp thư việc', icon: 'clipboard-check' },
          { href: '/mua-hang/yeu-cau', label: 'Yêu cầu mua', icon: 'factory' },
          { href: '/mua-hang/don', label: 'Đơn mua', icon: 'shopping-cart' },
          // truck dành cho GIAO NHẬN (từ vựng icon — /design-lab mục 05):
          // đây là màn thay "Hàng sắp về".
          { href: '/mua-hang/nhan-hang', label: 'Nhận hàng', icon: 'truck' },
          { href: '/mua-hang/hoa-don', label: 'Hoá đơn NCC', icon: 'receipt' },
        ],
      },
      {
        heading: 'Danh mục & tra cứu',
        items: [
          { href: '/mua-hang/ncc', label: 'Nhà cung cấp', icon: 'building-2' },
          { href: '/mua-hang/vat-tu', label: 'Vật tư', icon: 'package' },
          { href: '/mua-hang/bang-gia', label: 'Bảng giá', icon: 'circle-dollar-sign' },
          { href: '/mua-hang/ton', label: 'Tồn & cân đối', icon: 'boxes' },
        ],
      },
      /*
        CẦU TẠM — một mục, không phải năm.

        Mười màn cũ đều đã có màn mới thay (bảng trong test), nên bày lại cả
        mười là dựng lại đúng cái menu vừa gỡ. Nhưng cắt sạch đường về ngay
        ngày đầu thì ai phát hiện màn mới thiếu một việc sẽ không có chỗ nào
        đi tiếp. Một mục dẫn về trang tổng quan cũ là đủ: từ đó vào được mọi
        trang `/planning/*` như trước.

        XOÁ MỤC NÀY khi phòng đã chạy vài tuần trên bản mới mà không phải lùi.
      */
      {
        heading: 'Bản cũ',
        items: [
          { href: '/planning', label: 'Khu Cung ứng cũ', icon: 'arrow-left-right' },
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
    // tổ ở /to, kế hoạch ở /kehoach-sx. Từ đây quản đốc nhảy sang các
    // workspace kia qua switcher. (Khu thống kê /thongke đã xoá 26/08/2026.)
    sections: [
      {
        heading: 'Điều hành xưởng',
        items: [
          { href: '/production', label: 'Toàn cảnh xưởng', icon: 'factory' },
          { href: '/cat-phoi', label: 'Quy cắt phôi', icon: 'scissors' },
        ],
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
          { href: '/cat-phoi', label: 'Quy cắt phôi', icon: 'scissors' },
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
    // Dựng lại 26/08/2026 theo khung 5 bước. "Sổ sản lượng" (/thongke) đã XOÁ
    // 27/08/2026 theo yêu cầu — trang gốc nay redirect sang /thongke/lenh, nên
    // `route` vẫn để '/thongke' (đích redirect sau đăng nhập vẫn đúng chỗ).
    sections: [
      {
        heading: 'Thống kê',
        items: [
          { href: '/thongke/ghi', label: 'Ghi sản lượng', icon: 'notebook-pen' },
          { href: '/thongke/lenh', label: 'Tiến độ theo lệnh', icon: 'factory' },
          { href: '/thongke/ngay', label: 'Sổ ngày & chốt sổ', icon: 'calendar-check' },
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
          { href: '/kehoach-sx/tuan', label: 'Kế hoạch tuần', icon: 'calendar-check' },
          { href: '/kehoach-sx/tien-do', label: 'Tiến độ', icon: 'chart-gantt' },
          { href: '/kehoach-sx/chi-tieu', label: 'Chỉ tiêu ngày', icon: 'list-todo' },
          { href: '/kehoach-sx/theo-to', label: 'Theo tổ', icon: 'users-round' },
          { href: '/kehoach-sx/lenh', label: 'Lệnh đang chạy', icon: 'factory' },
          { href: '/cat-phoi', label: 'Quy cắt phôi', icon: 'scissors' },
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
    /*
     * 15/08/2026 — thiết kế lại toàn bộ (docs/exec-v3-approval-center.md): khu
     * GĐ tổ chức theo VIỆC CẦN QUYẾT ĐỊNH chứ không theo phòng ban, 3 tầng:
     *   1. Điều hành (action)  — Tổng quan + Chờ tôi phê duyệt (trung tâm).
     *   2. Theo dõi (monitoring) — Đơn hàng / Sản xuất / Mua hàng, chỉ đọc.
     *   3. Ký & báo cáo (analysis) — lịch sử ký, luật ký, báo cáo tuần.
     * Bản trước đó ("việc duy nhất của GĐ là ký" — exec-v2) thu sidebar về mỗi
     * Hộp ký; chủ dự án đảo lại: phê duyệt vẫn là trung tâm nhưng GĐ cần thêm
     * lớp theo dõi tổng thể ngay trong khu của mình.
     */
    sections: [
      {
        heading: 'Điều hành',
        items: [
          { href: '/exec', label: 'Tổng quan', icon: 'home' },
          // Stamp = con dấu. Trung tâm phê duyệt: mọi loại phiếu gom một chỗ.
          { href: '/exec/approvals', label: 'Chờ tôi phê duyệt', icon: 'stamp' },
        ],
      },
      {
        heading: 'Theo dõi',
        items: [
          // Vế BÁN: sổ đơn theo chuỗi KHÁCH → ĐƠN → LSX → VẬT TƯ.
          { href: '/exec/orders', label: 'Đơn hàng', icon: 'clipboard-list' },
          // Lệnh sản xuất mọi trạng thái — chỉ đọc, duyệt ở Trung tâm phê duyệt.
          { href: '/exec/production', label: 'Sản xuất', icon: 'factory' },
          // Vế MUA: đơn mua theo trạng thái, quá hẹn, đọng chưa gửi, NCC.
          { href: '/exec/purchasing', label: 'Mua hàng & NCC', icon: 'shopping-cart' },
        ],
      },
      {
        heading: 'Ký & báo cáo',
        items: [
          { href: '/exec/approvals/history', label: 'Lịch sử ký', icon: 'history' },
          { href: '/exec/luat-ky', label: 'Luật ký', icon: 'key-round' },
          // Trang dùng chung khu (manager) — chỉ role manager/admin vào được.
          {
            href: '/reports/weekly',
            label: 'Báo cáo tuần',
            icon: 'chart-column',
            roles: ['manager', 'admin'],
          },
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
            href: '/admin/doc-templates',
            label: 'Mẫu chứng từ',
            icon: 'file-text',
            roles: ['admin'],
          },
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
 * Gắn số đếm sống vào nav item theo href — server tính số (nav-badges.ts) rồi
 * gọi hàm này trước khi đưa sections xuống client. Thuần, không side effect.
 */
export function withNavBadges(
  sections: NavSection[],
  badges: Record<string, number>,
): NavSection[] {
  if (Object.keys(badges).length === 0) return sections
  return sections.map((s) => ({
    heading: s.heading,
    items: s.items.map((i) => (badges[i.href] ? { ...i, badge: badges[i.href] } : i)),
  }))
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
