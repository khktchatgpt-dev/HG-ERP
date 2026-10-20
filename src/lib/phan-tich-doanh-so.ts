/**
 * PHÂN TÍCH DOANH SỐ (06/10/2026) — "đơn đã nhận đang dồn vào đâu (khách, loại
 * hàng, khung, SP) và lãi kế hoạch ra sao?"
 *
 * NGUỒN: dòng đơn bán còn sống. Đo 06/10: 275 dòng · 143 SP · 3,40 triệu USD,
 * nhận đơn chỉ từ 08/2026. KHÔNG phải doanh thu đã ghi — hệ thống chưa có lần
 * xuất / hoá đơn nào.
 *
 * LÃI KẾ HOẠCH chỉ tính được trên SP có giá thành BÓC TÁCH (trực tiếp +
 * chung + lãi), đo 06/10: 21% trị giá; 79% còn lại chỉ có giá FOB. Mỗi con số
 * lãi PHẢI đi kèm độ phủ của nó — 11,6% trên 21% trị giá không phải 11,6% của
 * cả công ty.
 *
 * Giá bán so với giá FOB kế hoạch CHƯA so được: đơn giá được điền TỪ chính giá
 * FOB (05/10), 0/275 dòng lệch.
 */

import { PRODUCT_TYPES, FRAME_MATERIALS } from './product-code'

export type DongBan = {
  order_id: string
  order_code: string
  customer: string
  /** yyyy-mm — tháng nhận đơn (ngày lập đơn bán). */
  thang_nhan: string
  product_id: string | null
  product_code: string | null
  product_name: string | null
  product_type: string | null
  qty: number
  /** USD */
  value: number
  /** Lãi kế hoạch cả dòng (SL × lãi/SP) — null khi SP chưa có giá thành bóc tách. */
  lai: number | null
}

export type ChieuPhan = 'khach' | 'loai' | 'khung' | 'sp' | 'thang'

/** Vật liệu khung lấy từ ĐUÔI mã SP (TB0287HG-IR → IR) — ô `material` trống 191/275 dòng. */
export function khungCua(code: string | null): string | null {
  const m = code ? /HG-([A-Z]{2})$/.exec(code.trim()) : null
  return m ? m[1] : null
}

const nhanLoai = new Map<string, string>(PRODUCT_TYPES.map((t) => [t.code, t.label]))
const nhanKhung = new Map<string, string>(FRAME_MATERIALS.map((m) => [m.code, m.label]))

export type DongPhanTich = {
  key: string
  label: string
  /** Dòng phụ (tên SP, khách của SP…). */
  sub?: string
  so_don: number
  qty: number
  value: number
  /** Phần của tổng ĐANG LỌC (0–1). */
  share: number
  /** Lãi KH cộng trên các dòng có giá thành bóc tách. */
  lai: number
  /** Trị giá của CHÍNH các dòng có giá thành — mẫu số của % lãi. */
  value_co_gt: number
}

function khoa(
  d: DongBan,
  chieu: ChieuPhan,
): { key: string; label: string; sub?: string } {
  switch (chieu) {
    case 'khach':
      return { key: d.customer, label: d.customer }
    case 'loai': {
      const c = d.product_type ?? ''
      return { key: c || '∅', label: c ? (nhanLoai.get(c) ?? c) : 'Chưa xếp loại' }
    }
    case 'khung': {
      const c = khungCua(d.product_code) ?? ''
      return {
        key: c || '∅',
        label: c ? (nhanKhung.get(c) ?? c) : 'Mã không theo quy tắc',
      }
    }
    case 'sp':
      return {
        key: d.product_id ?? d.product_code ?? '∅',
        label: d.product_code ?? '—',
        sub: [d.product_name, d.customer].filter(Boolean).join(' · '),
      }
    case 'thang':
      return {
        key: d.thang_nhan,
        label: `${d.thang_nhan.slice(5, 7)}/${d.thang_nhan.slice(0, 4)}`,
      }
  }
}

/** Gom dòng đơn theo một chiều; xếp trị giá giảm dần (tháng thì theo thời gian). */
export function phanTheo(dongs: readonly DongBan[], chieu: ChieuPhan): DongPhanTich[] {
  const tong = dongs.reduce((s, d) => s + d.value, 0)
  const by = new Map<string, DongPhanTich & { _don: Set<string> }>()
  for (const d of dongs) {
    const k = khoa(d, chieu)
    const r =
      by.get(k.key) ??
      { ...k, so_don: 0, qty: 0, value: 0, share: 0, lai: 0, value_co_gt: 0, _don: new Set<string>() } // prettier-ignore
    r._don.add(d.order_id)
    r.qty += d.qty
    r.value += d.value
    if (d.lai != null) {
      r.lai += d.lai
      r.value_co_gt += d.value
    }
    by.set(k.key, r)
  }
  const rows = [...by.values()].map(({ _don, ...r }) => ({
    ...r,
    so_don: _don.size,
    share: tong > 0 ? r.value / tong : 0,
  }))
  return chieu === 'thang'
    ? rows.sort((a, b) => (a.key < b.key ? -1 : 1))
    : rows.sort((a, b) => b.value - a.value)
}

/** Tổng + độ phủ lãi cho đầu trang / chân bảng. */
export function tongHop(dongs: readonly DongBan[]) {
  const value = dongs.reduce((s, d) => s + d.value, 0)
  const coGt = dongs.filter((d) => d.lai != null)
  const value_co_gt = coGt.reduce((s, d) => s + d.value, 0)
  const lai = coGt.reduce((s, d) => s + (d.lai ?? 0), 0)
  return {
    value,
    qty: dongs.reduce((s, d) => s + d.qty, 0),
    so_don: new Set(dongs.map((d) => d.order_id)).size,
    so_khach: new Set(dongs.map((d) => d.customer)).size,
    so_sp: new Set(dongs.map((d) => d.product_id ?? d.product_code)).size,
    lai,
    value_co_gt,
    /** % lãi trên phần CÓ giá thành — null khi không dòng nào có. */
    lai_pct: value_co_gt > 0 ? lai / value_co_gt : null,
    /** Phần trị giá có giá thành bóc tách (độ phủ của % lãi). */
    phu: value > 0 ? value_co_gt / value : 0,
  }
}

/** n dòng đầu (đã xếp) chiếm bao nhiêu phần tổng. */
export function dauChiem(rows: readonly DongPhanTich[], n: number): number {
  return rows.slice(0, n).reduce((s, r) => s + r.share, 0)
}
