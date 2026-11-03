/**
 * ĐƠN HÀNG SALE ĐỔI SAU MỐC SOÁT (T4, 02/11/2026) — lõi thuần.
 *
 * Nguồn: lịch sử đơn có sẵn `sales_order_changes` (từ 17/08). Chỉ lấy loại ảnh
 * hưởng việc mua (bản vẽ FgRYhTxe… Q3): sửa DÒNG SP / HẠN GIAO (`update`) và
 * HUỶ đơn (`cancel`). Giá, trạng thái, đợt xuất bỏ qua. Lý do Sale ghi (bắt
 * buộc khi đơn đã phát lệnh) bày nguyên văn.
 *
 * Cờ "đơn đổi, lệnh chưa sửa theo" (Q4): so SL dòng đơn HIỆN TẠI với tổng SL các
 * dòng lệnh NỐI vào nó (`production_order_lines.sales_order_line_id`). Lệnh nạp
 * từ file không nối dòng đơn → "không so được"; KHÔNG so theo mã SP thay thế:
 * đơn có thể tính theo thùng / bộ còn lệnh theo cái (ROSCO "ghế = số thùng × 2")
 * — so thẳng là báo lệch giả.
 *
 * BẪY dữ liệu: `change.lines.before` ghi `product_code`, còn `change.lines.after`
 * ghi `product_id` (đúng thứ form gửi lên) — phải tra mã SP cho phía sau.
 */

export type SuKienDon = {
  order_id: string
  order_code: string
  change: Record<string, unknown>
  /** Lý do Sale ghi. */
  note: string | null
  /** Tên người sửa (đã tra). */
  boi: string | null
  created_at: string
}

/** Dòng đơn hiện tại. */
export type DongDonNay = {
  id: string
  order_id: string
  product_id: string | null
  code: string | null
  qty: number
}

/** Dòng lệnh hiện tại. */
export type DongLenhNay = {
  sales_order_line_id: string | null
  product_code: string | null
  qty: number
}

export type SoVoiLenh =
  /** Có nối: SL lệnh = SL đơn bây giờ. */
  | { k: 'theo'; slLenh: number }
  /** Có nối: SL lệnh khác SL đơn bây giờ. */
  | { k: 'chua_theo'; slDon: number; slLenh: number }
  /** Không nối dòng đơn — chỉ bày SL lệnh cùng mã để so tay. */
  | { k: 'khong_noi'; slLenhCungMa: number | null }
  /** Hạn giao: ngày xuất lệnh hiện tại để so tay. */
  | { k: 'ngay'; ngayLenh: string | null }
  /** Huỷ đơn: lệnh còn bao nhiêu dòng nối vào đơn (null = không nối, không biết). */
  | { k: 'huy'; dongLenhCon: number | null }

export type DongDonDoi = {
  key: string
  don: string
  order_id: string
  loai: 'sl' | 'han' | 'huy'
  /** Mã SP (loại `sl`). */
  sp: string | null
  truoc: number | string | null
  sau: number | string | null
  lyDo: string | null
  boi: string | null
  luc: string
  soLenh: SoVoiLenh
}

/** Dòng đơn có nối mà SL lệnh khác SL đơn — trạng thái bây giờ, không phụ thuộc mốc. */
export type LechDonLenh = { don: string; sp: string; slDon: number; slLenh: number }

const so = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const ma = (s: string | null | undefined) => s?.trim().toUpperCase() || null

/** SL theo mã SP của một phía `change.lines` (cộng dồn nếu một mã nhiều dòng). */
function slTheoMa(ds: unknown, maCuaSp: Map<string, string>): Map<string, number> {
  const out = new Map<string, number>()
  if (!Array.isArray(ds)) return out
  for (const x of ds as Record<string, unknown>[]) {
    const code =
      ma(x.product_code as string | undefined) ??
      ma(maCuaSp.get(String(x.product_id ?? '')))
    if (!code) continue
    out.set(code, (out.get(code) ?? 0) + so(x.qty))
  }
  return out
}

/**
 * Trích các thay đổi ảnh hưởng việc mua từ lịch sử đơn (sau mốc), mỗi dòng một
 * việc: một SP đổi SL (kể cả thêm / bỏ SP), hạn giao đổi, đơn huỷ — kèm lý do
 * Sale ghi và so với lệnh bây giờ.
 */
export function trichDoiDon(
  suKien: SuKienDon[],
  ctx: {
    maCuaSp: Map<string, string>
    dongDon: DongDonNay[]
    dongLenh: DongLenhNay[]
    ngayLenh: string | null
  },
): DongDonDoi[] {
  const lenhTheoDongDon = new Map<string, number>()
  for (const l of ctx.dongLenh)
    if (l.sales_order_line_id)
      lenhTheoDongDon.set(l.sales_order_line_id, (lenhTheoDongDon.get(l.sales_order_line_id) ?? 0) + l.qty) // prettier-ignore
  const lenhCungMa = (code: string) => {
    const ds = ctx.dongLenh.filter((l) => ma(l.product_code) === code)
    return ds.length ? ds.reduce((s, l) => s + l.qty, 0) : null
  }

  const soVoiSl = (orderId: string, code: string): SoVoiLenh => {
    const dd = ctx.dongDon.filter((d) => d.order_id === orderId && ma(d.code) === code)
    const noi = dd.filter((d) => lenhTheoDongDon.has(d.id))
    if (noi.length === 0) return { k: 'khong_noi', slLenhCungMa: lenhCungMa(code) }
    const slDon = dd.reduce((s, d) => s + d.qty, 0)
    const slLenh = noi.reduce((s, d) => s + (lenhTheoDongDon.get(d.id) ?? 0), 0)
    return Math.abs(slDon - slLenh) < 1e-6 ? { k: 'theo', slLenh } : { k: 'chua_theo', slDon, slLenh } // prettier-ignore
  }

  const out: DongDonDoi[] = []
  for (const e of [...suKien].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const t = e.change.type
    const goc = { don: e.order_code, order_id: e.order_id, lyDo: e.note?.trim() || null, boi: e.boi, luc: e.created_at } // prettier-ignore
    if (t === 'cancel') {
      const ids = new Set(
        ctx.dongDon.filter((d) => d.order_id === e.order_id).map((d) => d.id),
      )
      const coNoi = ctx.dongLenh.some((l) => l.sales_order_line_id)
      out.push({
        ...goc,
        key: `${e.order_id}|${e.created_at}|huy`,
        loai: 'huy',
        sp: null,
        truoc: null,
        sau: null,
        soLenh: {
          k: 'huy',
          dongLenhCon: coNoi ? ctx.dongLenh.filter((l) => l.sales_order_line_id && ids.has(l.sales_order_line_id)).length : null, // prettier-ignore
        },
      })
      continue
    }
    if (t !== 'update') continue
    const fields = (e.change.fields ?? {}) as Record<
      string,
      { from?: unknown; to?: unknown }
    >
    if (fields.due_date)
      out.push({
        ...goc,
        key: `${e.order_id}|${e.created_at}|han`,
        loai: 'han',
        sp: null,
        truoc: (fields.due_date.from as string | null) ?? null,
        sau: (fields.due_date.to as string | null) ?? null,
        soLenh: { k: 'ngay', ngayLenh: ctx.ngayLenh },
      })
    const lines = e.change.lines as { before?: unknown; after?: unknown } | undefined
    if (!lines) continue
    const a = slTheoMa(lines.before, ctx.maCuaSp)
    const b = slTheoMa(lines.after, ctx.maCuaSp)
    for (const code of [...new Set([...a.keys(), ...b.keys()])].sort()) {
      const x = a.get(code) ?? null
      const y = b.get(code) ?? null
      if (x !== null && y !== null && Math.abs(x - y) < 1e-6) continue
      out.push({
        ...goc,
        key: `${e.order_id}|${e.created_at}|${code}`,
        loai: 'sl',
        sp: code,
        truoc: x,
        sau: y,
        soLenh: soVoiSl(e.order_id, code),
      })
    }
  }
  return out
}

/** Mọi dòng đơn có nối mà SL lệnh ≠ SL đơn — cờ "lệnh chưa sửa theo đơn". */
export function lechDonLenh(
  dongDon: (DongDonNay & { don: string })[],
  dongLenh: DongLenhNay[],
): LechDonLenh[] {
  const theoDong = new Map<string, number>()
  for (const l of dongLenh)
    if (l.sales_order_line_id)
      theoDong.set(
        l.sales_order_line_id,
        (theoDong.get(l.sales_order_line_id) ?? 0) + l.qty,
      )
  return dongDon
    .filter((d) => theoDong.has(d.id) && Math.abs(theoDong.get(d.id)! - d.qty) >= 1e-6)
    .map((d) => ({
      don: d.don,
      sp: d.code ?? '—',
      slDon: d.qty,
      slLenh: theoDong.get(d.id)!,
    }))
}
