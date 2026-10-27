import { partGroupRank } from './part-groups'

/**
 * ĐỊNH MỨC CHƯA CÓ MÃ KHO — gom theo vật tư cho cả lệnh (22/10/2026).
 *
 * Bảng kê chỉ đọc được dòng định mức ĐÃ gắn mã vật tư. Dòng chưa gắn mã (hoặc
 * gắn một mã không có trong danh mục) trước đây bị bỏ qua IM LẶNG: lệnh GIGA có
 * 21 loại ngũ kim trong BOM nhưng bảng kê chỉ hiện 9 — đúng những mã đã nằm
 * trên đơn. Người mua tưởng thế là đủ.
 *
 * Nay gom chúng lại để bày ra: tên như Kỹ thuật ghi, cần bao nhiêu cho cả lệnh,
 * SP nào dùng. Có thể là vật tư MỚI (kho chưa có mã), cũng có thể chỉ là quên
 * gắn mã — người mua nhìn tên là biết đi đường nào.
 *
 * KHUNG (FRAME) không liệt kê từng dòng: chi tiết khung đặt tên theo VỊ TRÍ
 * ("Chân sau", "Tay vịn"), mua theo quy cách cắt chứ không theo tên — gom theo
 * tên là ra danh sách vô nghĩa. Chỉ đếm số dòng để nói ra.
 */

export type DongChuaMa = {
  product_id: string
  product_code: string
  /** SL sản phẩm của lệnh (đã cộng mọi dòng lệnh). */
  product_qty: number
  /** `group_code` của dòng định mức (NGU_KIM, PANEL, CUSHION…). */
  kind: string | null
  part_name: string | null
  qty: number | null
  unit: string | null
  /** Mã ghi trên dòng nhưng KHÔNG có trong danh mục — null = chưa gắn mã. */
  material_code: string | null
  material_note: string | null
  /**
   * Quy cách ghi trên dòng (dày × rộng × dài). Tên nệm, gối, mặt bàn chung
   * chung — "Gối" của ghế 1 chỗ và ghế 2 chỗ khác cỡ, gom chung là mua sai.
   */
  dims?: (number | null)[]
}

export type VatTuChuaMa = {
  /** Khoá gom: loại + tên đã chuẩn hoá. */
  key: string
  kind: string | null
  /** Tên như dòng định mức đầu tiên ghi (giữ nguyên chữ của Kỹ thuật). */
  name: string
  /** Quy cách "a×b×c" — thuộc khoá gom, khác cỡ là khác vật tư. */
  quy_cach: string | null
  /** Các cách viết khác của cùng vật tư ở SP khác — để người đọc khỏi tưởng thiếu. */
  aliases: string[]
  unit: string | null
  /** Ghi chú vật liệu / màu (cột "Vật liệu" của BOM: "xi đen", "Nhựa"). */
  note: string | null
  /** Mã ghi trên dòng mà danh mục không có (null = chưa gắn mã). */
  bad_code: string | null
  /** Tổng cần cho cả lệnh = Σ định mức × SL SP. Null nếu dòng không ghi số. */
  qty_total: number | null
  products: { product_id: string; code: string; per: number | null; qty: number }[]
}

export type ChuaMaCuaLenh = {
  items: VatTuChuaMa[]
  /** Số dòng khung chưa gắn mã — chỉ đếm (xem chú thích đầu file). */
  frame_lines: number
}

/**
 * Chuẩn hoá tên để gom: thường hoá, gọn khoảng trắng, bỏ khoảng trắng quanh
 * "x" giữa hai số ("M6 x 15" = "M6x15"), "bu lông"/"bulon" là một.
 */
export function chuanTen(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(\d)\s*[x×*]\s*(?=\d)/g, '$1x')
    .replace(/\bbu ?l[oô]ng\b|\bbulon\b/g, 'bulong')
}

const r4 = (n: number) => Math.round(n * 10_000) / 10_000

/** "22×47×65" từ các số > 0; không có số nào thì null. */
export function quyCach(dims: (number | null)[] | undefined): string | null {
  const so = (dims ?? []).filter(
    (v): v is number => v != null && Number.isFinite(v) && v > 0,
  )
  return so.length ? so.map((v) => String(r4(v))).join('×') : null
}

export function gomChuaMa(lines: DongChuaMa[]): ChuaMaCuaLenh {
  const byKey = new Map<string, VatTuChuaMa>()
  let frame = 0
  for (const l of lines) {
    const kind = l.kind?.trim().toUpperCase() || null
    if (kind === 'FRAME') {
      frame += 1
      continue
    }
    const name = (l.part_name ?? '').trim()
    if (!name) continue
    const qc = quyCach(l.dims)
    const key = `${kind ?? ''}|${chuanTen(name)}|${qc ?? ''}|${l.material_code?.trim().toUpperCase() ?? ''}`
    const per = l.qty != null && Number.isFinite(l.qty) ? l.qty : null
    let cur = byKey.get(key)
    if (!cur) {
      cur = {
        key,
        kind,
        name,
        quy_cach: qc,
        aliases: [],
        unit: l.unit?.trim() || null,
        note: l.material_note?.trim() || null,
        bad_code: l.material_code?.trim() || null,
        qty_total: 0,
        products: [],
      }
      byKey.set(key, cur)
    } else if (name !== cur.name && !cur.aliases.includes(name)) {
      cur.aliases.push(name)
    }
    if (!cur.unit && l.unit?.trim()) cur.unit = l.unit.trim()
    if (!cur.note && l.material_note?.trim()) cur.note = l.material_note.trim()
    // Dòng không ghi số thì tổng không còn là tổng — nói "chưa rõ" chứ không
    // cộng như số 0.
    cur.qty_total =
      per == null || cur.qty_total == null
        ? null
        : r4(cur.qty_total + per * l.product_qty)
    const p = cur.products.find((x) => x.product_id === l.product_id)
    if (p) p.per = p.per == null || per == null ? null : r4(p.per + per)
    else
      cur.products.push({
        product_id: l.product_id,
        code: l.product_code,
        per,
        qty: l.product_qty,
      })
  }
  // Ngũ kim lên đầu: đó là thứ người mua tự đi đặt theo tên (nệm, mặt bàn…
  // thường đặt cả món theo SP); còn lại theo thứ tự khối của bảng kê.
  const rank = (k: string | null) => (k === 'NGU_KIM' ? -1 : partGroupRank(k))
  const items = [...byKey.values()].sort(
    (a, b) => rank(a.kind) - rank(b.kind) || a.name.localeCompare(b.name, 'vi'),
  )
  return { items, frame_lines: frame }
}
