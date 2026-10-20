import type { BangKeRow } from '@/lib/lsx-bang-ke'

/**
 * BẢNG KÊ ĐỂ LÊN ĐƠN (08/10/2026) — lớp tính trên `BangKeRow` cho màn
 * `/mua-hang/yeu-cau/[id]/bang-ke`. Chủ dự án: "bảng kê là phần tính toán ra để
 * chuẩn bị lên đơn đặt" — nên mỗi dòng phải trả lời: cần bao nhiêu, đang có gì,
 * CÒN PHẢI ĐẶT bao nhiêu.
 *
 * Bốn luật đã chốt cùng bản vẽ (Q1–Q4):
 *  · Còn phải đặt = Cần − Tồn khả dụng − Đã gửi NCC − Nháp/chờ duyệt. Nháp là ý
 *    định mua đã ghi; không trừ thì vít 4×15 báo còn 28.864 trong khi nháp đã
 *    có 18.000 và người mua đặt chồng. Cột Nháp vẫn bày riêng để biết số đang
 *    dựa vào nháp.
 *  · Tồn khả dụng = tồn − giữ chỗ cho lệnh khác (`available`, cùng hàm form soạn đơn).
 *  · Cần LÀM TRÒN LÊN theo đơn vị mua: cây/con/cái tròn số nguyên (không ai mua
 *    0,72 cây), kg/m³/m²/mét giữ hai số lẻ. Số lẻ gốc giữ ở `canLe`.
 *  · Định mức chưa được Kỹ thuật kiểm vẫn tính (service đã cộng vào `qty_needed`
 *    khi bật `includeDraft`); màn nói rõ nguồn.
 */

export type TinhTrangMua =
  | 'chua_dat'
  | 'nhap_thieu'
  | 'da_gui_thieu'
  | 'du_nhap'
  | 'dang_ve'
  | 'da_ve'
  | 'du_ton'
  | 'chua_xac_nhan'
  | 'chua_dien'
  | 'ngoai_dm'

export const TINH_TRANG_MUA: Record<
  TinhTrangMua,
  { label: string; tone: 'stop' | 'warn' | 'run' | 'done' | 'neutral'; order: number }
> = {
  chua_dat: { label: 'Chưa đặt', tone: 'stop', order: 0 },
  nhap_thieu: { label: 'Nháp thiếu', tone: 'warn', order: 1 },
  da_gui_thieu: { label: 'Đã gửi, còn thiếu', tone: 'warn', order: 2 },
  du_nhap: { label: 'Đủ trên nháp', tone: 'run', order: 3 },
  dang_ve: { label: 'Đang về', tone: 'run', order: 4 },
  da_ve: { label: 'Đã về đủ', tone: 'done', order: 5 },
  du_ton: { label: 'Đủ tồn', tone: 'done', order: 6 },
  chua_xac_nhan: { label: 'Chờ xác nhận', tone: 'neutral', order: 7 },
  chua_dien: { label: 'Chưa điền số', tone: 'neutral', order: 8 },
  ngoai_dm: { label: 'Ngoài định mức', tone: 'neutral', order: 9 },
}

/** Thứ tự chip lọc trên màn: việc gấp lên trước. */
export const THU_TU_MUA: TinhTrangMua[] = [
  'chua_dat',
  'nhap_thieu',
  'da_gui_thieu',
  'du_nhap',
  'dang_ve',
  'da_ve',
  'du_ton',
  'chua_xac_nhan',
  'chua_dien',
  'ngoai_dm',
]

/** Đơn vị mua LIÊN TỤC — tròn hai số lẻ; còn lại là đếm được, tròn số nguyên. */
const DON_VI_LIEN_TUC = new Set([
  'kg',
  'm3',
  'm³',
  'm2',
  'm²',
  'm',
  'met',
  'mét',
  'lit',
  'lít',
  'l',
  'tan',
  'tấn',
])

/** Tròn LÊN theo đơn vị mua. Sai số dấu phẩy động (1.000000001) không được đẩy lên 2. */
export function lamTronMua(unit: string | null | undefined, qty: number): number {
  if (!(qty > 0)) return 0
  const u = (unit ?? '').trim().toLowerCase()
  const eps = 1e-6
  if (DON_VI_LIEN_TUC.has(u)) return Math.ceil(qty * 100 - eps) / 100
  return Math.ceil(qty - eps)
}

export type DongMua = {
  /** Cần đã làm tròn theo đơn vị mua. */
  can: number
  /** Cần chưa làm tròn — để bày tooltip / Excel. */
  canLe: number
  tonKhaDung: number
  daGui: number
  /** Nháp + chờ duyệt: đã ghi ý định mua nhưng chưa gửi NCC. */
  nhap: number
  daVe: number
  conPhaiDat: number
  tinhTrang: TinhTrangMua
}

const tron2 = (v: number) => Math.round(v * 100) / 100

export function tinhDongMua(r: BangKeRow): DongMua {
  const canLe = Math.max(r.qty_needed, 0)
  const can = lamTronMua(r.unit, canLe)
  const tonKhaDung = Math.max(r.available, 0)
  const daGui = Math.max(r.ordered, 0)
  const nhap = Math.max(r.draft, 0) + Math.max(r.pending, 0)
  const daVe = Math.max(r.received, 0)
  const conPhaiDat = tron2(Math.max(can - tonKhaDung - daGui - nhap, 0))

  let tinhTrang: TinhTrangMua
  if (r.source === 'none') tinhTrang = 'ngoai_dm'
  else if (r.status === 'unconfirmed') tinhTrang = 'chua_xac_nhan'
  else if (r.status === 'blank' || can === 0) tinhTrang = 'chua_dien'
  else if (conPhaiDat > 0) {
    tinhTrang = daGui > 0 ? 'da_gui_thieu' : nhap > 0 ? 'nhap_thieu' : 'chua_dat'
  } else if (daVe > 0 && daVe + tonKhaDung >= can) tinhTrang = 'da_ve'
  else if (daGui > 0) tinhTrang = 'dang_ve'
  else if (nhap > 0) tinhTrang = 'du_nhap'
  else tinhTrang = 'du_ton'

  return { can, canLe, tonKhaDung, daGui, nhap, daVe, conPhaiDat, tinhTrang }
}

/** Dòng tích được để lên đơn: còn phải đặt > 0. */
export function chonDuoc(d: DongMua): boolean {
  return d.conPhaiDat > 0
}

export function demTinhTrangMua(rows: DongMua[]): Record<TinhTrangMua, number> {
  const out = Object.fromEntries(THU_TU_MUA.map((t) => [t, 0])) as Record<
    TinhTrangMua,
    number
  >
  for (const d of rows) out[d.tinhTrang]++
  return out
}

/**
 * Đường dẫn mở màn soạn đơn với các mã đã tích, SL = còn phải đặt. Màn soạn đơn
 * nhận `?vt=A,B&sl=10,20&lsx=` (xem `don/moi/page.tsx`); tối đa 40 mã.
 */
export function hrefLenDon(
  lsxId: string,
  chon: { material_code: string; conPhaiDat: number }[],
): string | null {
  const ds = chon.filter((c) => c.material_code && c.conPhaiDat > 0).slice(0, 40)
  if (ds.length === 0) return null
  const vt = ds.map((c) => c.material_code).join(',')
  const sl = ds.map((c) => String(c.conPhaiDat)).join(',')
  return `/mua-hang/don/moi?lsx=${encodeURIComponent(lsxId)}&vt=${encodeURIComponent(vt)}&sl=${encodeURIComponent(sl)}`
}
