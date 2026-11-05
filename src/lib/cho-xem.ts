/**
 * HỘP "CHỜ TÔI XEM" CỦA TRƯỞNG PHÒNG CUNG ỨNG (05/11/2026, bản vẽ
 * https://claude.ai/artifact/RcqWLU7F1z33btAR97gZBo — khung 1 và 2).
 *
 * Hình dữ liệu server → màn + các phép thuần màn dùng. Thuần, client import được.
 * Dấu "đã xem" suy ở lib/po-review; file này chỉ chia hộp, so giá, gom nhóm.
 */
import type { DauDaXem } from './po-review'

/** Một dòng hàng trong ô xem nhanh dưới dòng đơn. */
export type XemDong = {
  id: string
  ma: string | null
  ten: string
  quy_cach: string | null
  sl: number
  dvt: string | null
  /** Số theo đơn vị tính giá (m³, kg…) khi đơn giá tính trên đơn vị đó. */
  qd: number | null
  dvt_gia: string | null
  don_gia: number | null
  thanh_tien: number
  /** Giá lần mua gần nhất cùng NCC (Q6) — null: chưa từng mua món này ở NCC này. */
  truoc: GiaTruoc | null
}

export type GiaTruoc = { gia: number; po_code: string; at: string }

/** Một đơn chờ duyệt trong hộp của trưởng phòng. */
export type XemDon = {
  id: string
  code: string
  href: string
  ncc: string
  ncc_day_du: string
  loai: string | null
  materials: string[]
  lsx: string | null
  ngoai_lenh: string | null
  expected_at: string | null
  owner_id: string | null
  owner_name: string | null
  currency: string
  tien_hang: number
  vat_rate: number
  vat: number
  value: number
  /** Vượt ngưỡng giá trị lớn (cùng luật hộp ký GĐ) → không tích hàng loạt (Q2). */
  big: boolean
  /** Nháp = lần sửa cuối; chờ duyệt = lần gửi duyệt cuối. */
  submitted_at: string
  thanh_toan: string | null
  /** null = trưởng phòng CHƯA xem. */
  mark: DauDaXem | null
  /**
   * true = NHÁP (đường thường: anh bấm "Đã xem — trình GĐ" là đơn lên bàn GĐ).
   * false = đơn NV đã GỬI THẲNG GĐ, anh xem bổ sung.
   */
  nhap: boolean
  /** Nháp chưa trình được vì sao (`lyDoChuaTrinh`) — khoá nút trình. null = trình được. */
  chan: string | null
  /** Nháp từng bị trả lại và NV đã sửa lại — nhãn "đã sửa sau khi trả lại". */
  tra_lai: { at: string; by_name: string | null; reason: string | null } | null
  dong: XemDong[]
}

/** Đơn Giám đốc đã duyệt khi trưởng phòng chưa xem — tab chỉ xem, giữ 7 ngày (Q4). */
export type DuyetThay = {
  id: string
  code: string
  href: string
  ncc: string
  loai: string | null
  materials: string[]
  lsx: string | null
  by_name: string | null
  at: string
  /** Phút từ lần gửi duyệt cuối tới lúc duyệt — null khi sổ thiếu mốc gửi. */
  sau_phut: number | null
  currency: string
  value: number
}

export type HopXem = {
  items: XemDon[]
  duyet_thay: DuyetThay[]
  /** Mốc dựng dữ liệu — "cập nhật 09:12" ở thanh trạng thái. */
  at: string
}

/** Số ngày giữ đơn trong tab "GĐ duyệt khi tôi chưa xem" (Q4). */
export const GIU_DUYET_THAY_NGAY = 7

/** Tab 1: chưa xem. Badge menu đếm ĐÚNG hàm này. */
export const choXem = (items: XemDon[]) => items.filter((d) => !d.mark)
/** Tab 2: đã xem, đang chờ Giám đốc. */
export const daXemChoGd = (items: XemDon[]) => items.filter((d) => !!d.mark)

/** Q2 — xác nhận hàng loạt chỉ với đơn DƯỚI ngưỡng giá trị lớn; đơn lớn mở ra đọc. */
export const tichDuoc = (d: Pick<XemDon, 'big'> & Partial<Pick<XemDon, 'chan'>>) =>
  !d.big && !d.chan

/**
 * Giá lần mua GẦN NHẤT cùng NCC của một vật tư, bỏ chính đơn đang xem.
 * `prices` là mọi lần mua đã gửi NCC (pos.repo `pricesForSuppliers`).
 */
export function giaTruocCungNcc(
  prices: {
    supplier_id: string
    material_id: string
    po_id: string
    po_code: string
    unit_price: number
    at: string
  }[],
  supplierId: string,
  materialId: string | null,
  boPoId: string,
): GiaTruoc | null {
  if (!materialId) return null
  let best: (typeof prices)[number] | null = null
  for (const p of prices) {
    if (
      p.supplier_id !== supplierId ||
      p.material_id !== materialId ||
      p.po_id === boPoId
    )
      continue
    if (!best || p.at > best.at) best = p
  }
  return best ? { gia: best.unit_price, po_code: best.po_code, at: best.at } : null
}

/** So đơn giá với lần trước: bằng / tăng / giảm + % lệch (làm tròn 0,1). */
export function soGia(
  gia: number | null,
  truoc: GiaTruoc | null,
): { kieu: 'bang' | 'tang' | 'giam'; pct: number } | null {
  if (gia == null || !truoc || !(truoc.gia > 0)) return null
  const lech = gia - truoc.gia
  if (Math.abs(lech) < 0.005) return { kieu: 'bang', pct: 0 }
  const pct = Math.round((Math.abs(lech) / truoc.gia) * 1000) / 10
  return { kieu: lech > 0 ? 'tang' : 'giam', pct }
}

/** Gom theo người lập (mặc định) hoặc theo lệnh — khối nhiều đơn nhất lên trước. */
export function gomDon(
  items: XemDon[],
  theo: 'nguoi' | 'lenh' | 'khong',
): { key: string; ten: string; rows: XemDon[] }[] {
  if (theo === 'khong') return [{ key: 'all', ten: '', rows: items }]
  const m = new Map<string, { ten: string; rows: XemDon[] }>()
  for (const d of items) {
    const key = theo === 'nguoi' ? (d.owner_id ?? '@') : (d.lsx ?? d.ngoai_lenh ?? '@')
    const ten =
      theo === 'nguoi'
        ? (d.owner_name ?? 'Chưa rõ người lập')
        : (d.lsx ?? d.ngoai_lenh ?? 'Ngoài lệnh')
    const g = m.get(key)
    if (g) g.rows.push(d)
    else m.set(key, { ten, rows: [d] })
  }
  return [...m.entries()]
    .map(([key, g]) => ({ key, ...g }))
    .sort((a, b) => b.rows.length - a.rows.length || a.ten.localeCompare(b.ten, 'vi'))
}

/** Số lượng kiểu VN ("1.040.000", "2,0395") — tối đa `le` chữ số lẻ. */
export function soVn(n: number, le = 4): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: le }).format(n)
}

/** Tiền kèm mã tiền — VND không lẻ, ngoại tệ 2 số lẻ (như hộp ký). */
export function tienVn(n: number, currency: string): string {
  return `${soVn(n, currency === 'VND' ? 0 : 2)} ${currency}`
}

/** "Đã gửi bao lâu" gọn một ô: 25 phút · 18 giờ · 3 ngày. */
export function daGui(iso: string, now: Date): string {
  const phut = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000))
  if (phut < 60) return `${phut} phút`
  const gio = Math.round(phut / 60)
  if (gio < 24) return `${gio} giờ`
  return `${Math.floor(gio / 24)} ngày`
}

/** Cộng tiền theo từng loại tiền — không quy đổi (như chân bảng hộp ký). */
export function congTheoTien(items: { currency: string; value: number }[]) {
  const m = new Map<string, number>()
  for (const d of items) m.set(d.currency, (m.get(d.currency) ?? 0) + d.value)
  return [...m.entries()].map(([currency, value]) => ({ currency, value }))
}
