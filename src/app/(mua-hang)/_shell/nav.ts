/**
 * CÂY MENU CỦA MODULE MUA HÀNG — xếp theo DÒNG CHẢY NGHIỆP VỤ, không theo phòng.
 *
 * Chốt 10/09/2026 sau khi chủ dự án chỉ ra bản trước vẫn là "mười trang trên
 * một thanh", tức xương của sidebar cũ đội vỏ mới. ERP thật (SAP, Dynamics,
 * Odoo, NetSuite) không có bốn trang "việc" cho một vai; họ có:
 *
 *   · MỘT bàn làm việc theo vai (Dynamics workspace / SAP launchpad group);
 *   · các LOẠI CHỨNG TỪ dọc chuỗi Procure-to-Pay: Yêu cầu → Đơn → Nhận hàng →
 *     Hoá đơn — mỗi loại một danh sách, "việc" là khung nhìn trên danh sách đó;
 *   · danh mục và tra cứu;
 *   · MỘT hộp thư việc ở VỎ ứng dụng, xuyên mọi module — không phải mục menu.
 *
 * Bốn trang cũ đi đâu: "Vấn đề" + "Họp" gộp vào Bàn làm việc; "Hàng sắp về" là
 * khung nhìn `dang-ve` của Đơn mua; "Vật tư theo lệnh" + "Bảng kê" trở thành
 * chứng từ Yêu cầu mua. Không mất câu hỏi nào, chỉ mất bốn mục menu.
 */

export type SupplyNavItem = {
  href: string
  label: string
  icon: string
  /** Khuôn màn theo sổ thiết kế. */
  plan: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  q: string
}
export type SupplyNavGroup = { heading: string; items: SupplyNavItem[] }

export const SUPPLY_NAV: SupplyNavGroup[] = [
  {
    heading: 'Mua hàng',
    items: [
      { href: '/mua-hang', label: 'Bàn làm việc', icon: 'home', plan: 'A', q: 'Hôm nay tôi bắt đầu từ đâu?' },
    ],
  },
  {
    heading: 'Chứng từ',
    items: [
      { href: '/mua-hang/yeu-cau', label: 'Yêu cầu mua', icon: 'factory', plan: 'C', q: 'Lệnh nào còn thiếu đồ, cần đặt gì?' },
      { href: '/mua-hang/don', label: 'Đơn mua', icon: 'shopping-cart', plan: 'C', q: 'Đơn nào cần tôi động vào?' },
      { href: '/mua-hang/nhan-hang', label: 'Nhận hàng', icon: 'truck', plan: 'C', q: 'Hàng về tới đâu?' },
      { href: '/mua-hang/hoa-don', label: 'Hoá đơn NCC', icon: 'receipt', plan: 'C', q: 'Còn nợ nhà cung cấp bao nhiêu?' },
    ],
  },
  {
    heading: 'Danh mục',
    items: [
      { href: '/mua-hang/ncc', label: 'Nhà cung cấp', icon: 'building-2', plan: 'E', q: 'Mua của ai, họ làm ăn ra sao?' },
      { href: '/mua-hang/vat-tu', label: 'Vật tư', icon: 'package', plan: 'E', q: 'Mã này là gì, mua của ai?' },
      { href: '/mua-hang/bang-gia', label: 'Bảng giá', icon: 'circle-dollar-sign', plan: 'C', q: 'Ai chào giá bao nhiêu, còn hiệu lực không?' },
    ],
  },
  {
    heading: 'Tra cứu',
    items: [
      { href: '/mua-hang/ton', label: 'Tồn & cân đối', icon: 'boxes', plan: 'C', q: 'Còn bao nhiêu, có phải mua không?' },
    ],
  },
]

/** Hộp thư việc — ở VỎ, không nằm trong cây menu. */
export const INBOX_HREF = '/mua-hang/hop-thu'

export const SUPPLY_HREFS = SUPPLY_NAV.flatMap((g) => g.items.map((i) => i.href))

export function activeSupplyHref(pathname: string): string {
  const hit = SUPPLY_HREFS.filter(
    (h) => h !== '/mua-hang' && (pathname === h || pathname.startsWith(h + '/')),
  ).sort((a, b) => b.length - a.length)[0]
  return hit ?? '/mua-hang'
}
