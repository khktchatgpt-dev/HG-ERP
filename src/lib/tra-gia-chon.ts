/**
 * TRA GIÁ — PHƯƠNG ÁN GIÁ của một món và NCC đang chọn (28/10/2026).
 *
 * Một món có tới ba nguồn giá, xếp chung một bảng:
 *   · ĐƠN  — giá trên đơn mua (`TgNcc`): chốt thì xếp hạng, nháp thì chỉ bày.
 *   · HỎI  — giá người mua vừa gọi hỏi (điện thoại, Zalo), ghi tay trên màn.
 *            KHÔNG lưu vào hệ thống (câu Q4 bản vẽ) — chỉ sống trong danh sách
 *            nháp và file Excel.
 *   · GỢI Ý — món chưa mua bao giờ: giá đ/kg của NCC từng bán cùng loại. Chỉ là
 *            THAM KHẢO: chọn được để lên Excel, nhưng không xếp hạng và không
 *            cộng vào tổng tiền.
 *
 * Thuần — màn hình và file Excel (bước 3) cùng tính bằng hàm này, để "rẻ nhất"
 * và "NCC đang chọn" trên màn với trong file là MỘT con số.
 */
import type { TgGoiY, TgKetQua, TgNcc } from './tra-gia'

export type GiaHoi = {
  id: string
  /** Tên NCC như người mua gõ — có thể chưa có trong danh mục. */
  ncc: string
  gia: number
  ghi_chu: string | null
  /** yyyy-mm-dd — ngày ghi. */
  at: string
}

export type PhuongAn = {
  /** supplier_id · `hoi:<id>` · `goiy:<supplier_id>` — khoá chọn. */
  key: string
  ten: string
  gia: number
  dv: string
  nguon: 'don' | 'hoi' | 'goi_y'
  /** Lên bảng xếp hạng (cùng đơn vị, giá chốt hoặc giá hỏi). */
  so_duoc: boolean
  /** Bấm chọn được làm NCC của món. Đơn nháp: không. */
  chon_duoc: boolean
  /** Thật hay tham khảo — tham khảo không cộng vào tổng tiền. */
  tham_khao: boolean
  ncc?: TgNcc
  goi_y?: TgGoiY
  hoi?: GiaHoi
}

const HANG = (p: PhuongAn) => (p.so_duoc ? 0 : p.nguon === 'don' && p.chon_duoc ? 1 : p.nguon === 'goi_y' ? 2 : 3) // prettier-ignore

/** Mọi phương án giá của món, đã xếp: so được (rẻ → đắt) · chốt khác đơn vị · tham khảo · nháp. */
export function phuongAn(
  kq: TgKetQua | null,
  hoi: readonly GiaHoi[],
): { ds: PhuongAn[]; re: number | null; dv: string | null } {
  const dv = kq?.dv_so ?? kq?.quy_cach?.dv ?? null
  const ds: PhuongAn[] = []
  for (const n of kq?.ncc ?? [])
    ds.push({ key: n.supplier_id, ten: n.supplier_name, gia: n.gia, dv: n.dv, nguon: 'don', so_duoc: n.so_duoc, chon_duoc: n.chot, tham_khao: false, ncc: n }) // prettier-ignore
  // Giá hỏi: người mua ghi theo đúng đơn vị đang so (hộp ghi nói rõ) → xếp hạng chung.
  for (const h of hoi)
    ds.push({ key: `hoi:${h.id}`, ten: h.ncc, gia: h.gia, dv: dv ?? '', nguon: 'hoi', so_duoc: true, chon_duoc: true, tham_khao: false, hoi: h }) // prettier-ignore
  if (kq?.trang_thai === 'moi')
    for (const g of kq.goi_y)
      if (g.gia != null && g.dv)
        ds.push({ key: `goiy:${g.supplier_id}`, ten: g.supplier_name, gia: g.gia, dv: g.dv, nguon: 'goi_y', so_duoc: false, chon_duoc: true, tham_khao: true, goi_y: g }) // prettier-ignore
  ds.sort((a, b) => HANG(a) - HANG(b) || a.gia - b.gia || (a.nguon === 'don' ? -1 : 1))
  const so = ds.filter((p) => p.so_duoc)
  return { ds, re: so.length ? Math.min(...so.map((p) => p.gia)) : null, dv }
}

/**
 * NCC đang chọn cho món: lựa chọn của người mua nếu còn hợp lệ, không thì phương
 * án RẺ NHẤT so được. Món chỉ có giá tham khảo thì KHÔNG tự chọn — phải bấm.
 */
export function dangChon(
  ds: readonly PhuongAn[],
  chon: string | null | undefined,
): PhuongAn | null {
  const p = chon ? ds.find((x) => x.key === chon && x.chon_duoc) : null
  return p ?? ds.find((x) => x.so_duoc) ?? null
}

/** Thành tiền của phương án đang chọn — null khi chưa có SL hoặc giá chỉ là tham khảo. */
export function thanhTien(p: PhuongAn | null, sl: number | null): number | null {
  if (!p || p.tham_khao || sl == null || !(sl > 0)) return null
  return Math.round(p.gia * sl)
}

/** Một món đã tính phương án — đầu vào của `gomTheoNcc`. */
export type MonDaTinh = {
  /** Tên bày: quy cách khớp, không có thì chữ người gõ. */
  nhan: string
  ds: readonly PhuongAn[]
  re: number | null
  chon: PhuongAn | null
  tien: number | null
}

/** Một NCC trên lưới / tờ "Theo NCC". */
export type NccGom = {
  key: string
  ten: string
  /** supplier_id khi NCC có trong danh mục — giá hỏi gõ tay thì không. */
  id: string | null
  /** Các món NCC này có giá chọn được (giá chốt hoặc giá hỏi). */
  mon: string[]
  /** Số món NCC này rẻ nhất (khi có ≥ 2 NCC so được). */
  re: number
  chon: string[]
  tien: number
  /** yyyy-mm-dd — lần mua / lần hỏi gần nhất. */
  last: string
}

/**
 * CÂU NGƯỢC LẠI — gom theo NHÀ CUNG CẤP: bán được bao nhiêu món trong danh sách,
 * rẻ nhất ở mấy món, các món đang chọn họ thành bao nhiêu tiền. Lưới "Theo NCC"
 * và tờ Excel cùng đếm bằng hàm này. Giá tham khảo và đơn nháp không tính.
 */
export function gomTheoNcc(mons: readonly MonDaTinh[]): NccGom[] {
  const by = new Map<string, NccGom>()
  for (const t of mons) {
    const soDuoc = t.ds.filter((x) => x.so_duoc).length
    for (const p of t.ds) {
      if (!p.chon_duoc || p.tham_khao) continue
      // Giá hỏi gõ tay: gom theo TÊN (không có mã NCC), hai lần hỏi cùng một nơi là một NCC.
      const key = p.ncc ? p.ncc.supplier_id : `hoi:${p.ten.trim().toLowerCase()}`
      const h = by.get(key) ?? { key, ten: p.ten, id: p.ncc?.supplier_id ?? null, mon: [], re: 0, chon: [], tien: 0, last: '' } // prettier-ignore
      h.mon.push(t.nhan)
      if (p.so_duoc && p.gia === t.re && soDuoc > 1) h.re++
      if (t.chon?.key === p.key) {
        h.chon.push(t.nhan)
        h.tien += t.tien ?? 0
      }
      const at = p.ncc?.at ?? p.hoi?.at ?? ''
      if (at > h.last) h.last = at
      by.set(key, h)
    }
  }
  return [...by.values()].sort(
    (a, b) => b.chon.length - a.chon.length || b.mon.length - a.mon.length || b.re - a.re,
  )
}
