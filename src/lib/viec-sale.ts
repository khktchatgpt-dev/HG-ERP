/**
 * TRANG CHỦ SALE — "hôm nay tôi phải làm gì?" (06/10/2026).
 *
 * Mỗi LÀN là một loại việc, và mỗi làn TỰ BÀY các mục của nó: con số trên làn
 * chính là số dòng người đọc thấy ngay bên dưới — không có "con số hứa một đằng,
 * trang đích lọc một nẻo" (luật 3 của sổ thiết kế). Đợt xuất dùng CHUNG
 * `tinhTrang` với Kế hoạch xuất hàng; giá thành dùng CHUNG `stats.complete`
 * của trang Giá thành kế hoạch.
 *
 * Bỏ 8 ô KPI cũ (khách active, báo giá nháp, giá trị tháng…): đếm cho có, không
 * chỉ ra việc gì. Số tổng hợp đã có chỗ ở Phân tích doanh số / Kế hoạch xuất.
 */

export type MucViec = {
  id: string
  /** Chữ chính của dòng (mã + khách…). */
  title: string
  /** Chi tiết phụ một dòng. */
  detail?: string
  /*
    Cột của LƯỚI kiểu ERP (06/10/2026, chủ dự án: "thiên hướng UI/UX ERP") —
    mỗi mục bày thành một dòng bảng có cột, không phải một dòng chữ ghép.
  */
  /** Mã chứng từ (lệnh, đơn, báo giá). */
  ma?: string | null
  khach?: string | null
  /** Nội dung riêng của làn (PO khách, "4 dòng giá 0"…). */
  noi_dung?: string | null
  /** yyyy-mm-dd — ngày xuất / ngày lập tuỳ làn (tên cột ở `LanViec.cot_ngay`). */
  ngay?: string | null
  /** USD */
  tri_gia?: number | null
  /** Nhãn tình trạng bên phải. */
  tag?: { tone: 'stop' | 'warn' | 'done' | 'neutral'; text: string }
  href: string
}

export type LanViec = {
  key: 'de-y' | 'gia-0' | 'chua-ngay' | 'han-giao' | 'gia-thanh' | 'bao-gia'
  title: string
  /** Tên NGẮN cho ô đếm (dải ô một hàng ở 1280px). */
  short: string
  /** Việc phải làm — thể mệnh lệnh. */
  action: string
  /** Vì sao mục rơi vào làn (một câu). */
  why: string
  tone: 'stop' | 'warn' | 'neutral'
  /** Số mục — BẰNG số dòng của `items` khi `items` đủ; làn gom (giá thành) thì ghi rõ ở `count_note`. */
  count: number
  count_note?: string
  items: MucViec[]
  /** Trang xử lý cả làn. */
  more?: { href: string; label: string }
  /** Tên cột ngày của lưới ("Ngày xuất", "Ngày lập"). Bỏ trống = làn không có cột ngày. */
  cot_ngay?: string
}

/** Làn rỗng không bày (việc không có thì không chiếm chỗ); thứ tự = độ khẩn. */
export function sapLan(lans: LanViec[]): LanViec[] {
  const rank = { stop: 0, warn: 1, neutral: 2 }
  return lans
    .filter((l) => l.count > 0)
    .sort((a, b) => rank[a.tone] - rank[b.tone] || b.count - a.count)
}
