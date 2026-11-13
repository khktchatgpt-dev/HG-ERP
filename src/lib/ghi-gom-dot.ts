/**
 * GOM ĐỢT ở màn Ghi sản lượng (bản vẽ 12/11/2026,
 * https://claude.ai/artifact/6j48VVVcNEvMie7iNnbd3v, Q1 duyệt).
 *
 * Lệnh nhiều đợt (GIGA: 5 đợt × 8 mã hàng) sinh MỘT dòng lệnh mỗi (đợt × mã
 * hàng), nên cùng một chi tiết hiện 4–5 lần — Phôi 603 dòng mà chỉ 140 chi tiết
 * khác nhau. Xưởng cắt phôi cho cả lệnh chứ không cắt riêng từng đợt, nên lưới
 * gom về MỘT dòng mỗi chi tiết của mã hàng; số gõ vào tự chia cho đợt xuất sớm
 * trước (đợt đầu đủ mới sang đợt sau). Sổ vẫn ghi theo từng component như cũ —
 * API ghi không đổi, một phiếu nhận nhiều dòng.
 *
 * Thuần, không chạm DB — server gom trước khi cắt trần hiển thị, client chia
 * lúc ghi. Có test.
 */

/** Khoá gom: cùng lệnh + mã hàng + loại dòng + cụm + tên chi tiết. */
export function khoaGom(p: {
  lsx_id: string
  product_code: string
  kind: string
  cluster: string | null
  name: string
}): string {
  return ['g', p.lsx_id, p.product_code, p.kind, p.cluster ?? '', p.name].join('|')
}

export type PhanDot = {
  component_id: string
  order_line_id: string
  /** Tên đợt để nói ra ("Đợt 1"); null khi lệnh một đợt. */
  dot: string | null
  ship_date: string | null
  /** Thứ tự đợt lúc soạn lệnh — phá hoà khi cùng ngày xuất. */
  sort: number
  needed: number
  done: number
  pending: number
  remaining: number
}

type DongGoc = {
  component_id: string
  kind: 'part' | 'assembly'
  is_virtual: boolean
  cluster: string | null
  name: string
  unit: string | null
  dm_kg: number | null
  needed: number
  done: number
  pending: number
  remaining: number
  today_qty: number
  days: { date: string; qty: number; docs: number }[]
  available: number | null
}

type NhomGoc<L extends DongGoc> = {
  order_line_id: string
  lsx_id: string
  lsx_code: string
  customer_name: string
  product_code: string
  product_name: string
  qty: number
  unit: string
  image_src: string | null
  dot: string | null
  ship_date: string | null
  dot_sort: number
  lines: L[]
}

export type DongGom<L extends DongGoc> = L & { parts: PhanDot[] }
export type NhomGom<L extends DongGoc, G extends NhomGoc<L>> = Omit<G, 'lines'> & {
  /** Số đợt có mặt trong nhóm (đầu nhóm nói "5 đợt"). */
  dots: number
  order_line_ids: string[]
  lines: DongGom<L>[]
}

/**
 * Gom các dòng lệnh cùng (lệnh, mã hàng) thành một nhóm; trong nhóm gom dòng
 * cùng khoá. Cộng cần / đã làm / chờ / còn / hôm nay / nhịp ngày; khả dụng cộng
 * khi có, null khi mọi đợt đều null (đầu lộ trình). Giữ thứ tự xuất hiện đầu.
 * `component_id` của dòng gom = khoá gom (ổn định giữa các lần tải).
 */
export function gomTheoMaHang<L extends DongGoc, G extends NhomGoc<L>>(
  groups: G[],
): NhomGom<L, G>[] {
  const out: NhomGom<L, G>[] = []
  const byGroup = new Map<string, NhomGom<L, G>>()
  const byLine = new Map<string, DongGom<L>>()
  const sorted = [...groups].sort(
    (a, b) =>
      (a.ship_date ?? '9999').localeCompare(b.ship_date ?? '9999') ||
      a.dot_sort - b.dot_sort,
  )
  // Thứ tự NHÓM theo lần xuất hiện đầu trong danh sách gốc (đúng thứ tự soạn).
  const firstSeen = new Map<string, number>()
  groups.forEach((g, i) => {
    const k = `${g.lsx_id}|${g.product_code}`
    if (!firstSeen.has(k)) firstSeen.set(k, i)
  })
  for (const g of sorted) {
    const gk = `${g.lsx_id}|${g.product_code}`
    let ng = byGroup.get(gk)
    if (!ng) {
      const { lines: _drop, ...rest } = g
      void _drop
      ng = { ...rest, qty: 0, dots: 0, order_line_ids: [], lines: [] }
      byGroup.set(gk, ng)
      out.push(ng)
    }
    ng.qty += g.qty
    ng.dots += 1
    ng.order_line_ids.push(g.order_line_id)
    if (!ng.ship_date || (g.ship_date && g.ship_date < ng.ship_date))
      ng.ship_date = g.ship_date
    for (const l of g.lines) {
      const key = khoaGom({
        lsx_id: g.lsx_id,
        product_code: g.product_code,
        kind: l.kind,
        cluster: l.cluster,
        name: l.name,
      })
      const part: PhanDot = {
        component_id: l.component_id,
        order_line_id: g.order_line_id,
        dot: g.dot,
        ship_date: g.ship_date,
        sort: g.dot_sort,
        needed: l.needed,
        done: l.done,
        pending: l.pending,
        remaining: l.remaining,
      }
      const cur = byLine.get(key)
      if (!cur) {
        const fresh = {
          ...l,
          component_id: key,
          days: l.days.map((d) => ({ ...d })),
          parts: [part],
        } as DongGom<L>
        byLine.set(key, fresh)
        ng.lines.push(fresh)
        continue
      }
      cur.needed += l.needed
      cur.done += l.done
      cur.pending += l.pending
      cur.remaining += l.remaining
      cur.today_qty += l.today_qty
      cur.available =
        cur.available == null && l.available == null
          ? null
          : (cur.available ?? 0) + (l.available ?? 0)
      cur.dm_kg = cur.dm_kg ?? l.dm_kg
      cur.is_virtual = cur.is_virtual && l.is_virtual
      for (const d of l.days) {
        const x = cur.days.find((y) => y.date === d.date)
        if (x) {
          x.qty += d.qty
          x.docs += d.docs
        } else cur.days.push({ ...d })
      }
      cur.parts.push(part)
    }
  }
  return out.sort(
    (a, b) =>
      (firstSeen.get(`${a.lsx_id}|${a.product_code}`) ?? 0) -
      (firstSeen.get(`${b.lsx_id}|${b.product_code}`) ?? 0),
  )
}

export type ChiaRa = {
  component_id: string
  dot: string | null
  qty: number
  defect: number
  rework: number
  kg: number | null
}

/**
 * Chia số gõ trên dòng gom về từng đợt: đợt xuất sớm trước, mỗi đợt nhận tới
 * phần còn thiếu của nó (trừ cả số đang chờ để hai phiếu không cùng lấp một
 * chỗ); dư thì dồn vào đợt CUỐI (sổ vẫn cảnh báo vượt như cũ). Phế / sửa lại đi
 * theo đợt đầu tiên nhận số đạt — không có đạt thì đợt đầu còn thiếu. Kg gõ tay
 * chia theo tỉ lệ số đạt.
 */
export function chiaDot(
  parts: PhanDot[],
  v: { qty: number; defect: number; rework: number; kg: number | null },
): ChiaRa[] {
  if (parts.length === 0) return []
  const order = [...parts].sort(
    (a, b) =>
      (a.ship_date ?? '9999').localeCompare(b.ship_date ?? '9999') || a.sort - b.sort,
  )
  const qty = new Map<string, number>()
  let left = Math.max(0, v.qty)
  for (const p of order) {
    if (left <= 0) break
    const cap = Math.max(0, p.remaining - p.pending)
    const take = Math.min(cap, left)
    if (take > 0) {
      qty.set(p.component_id, take)
      left -= take
    }
  }
  if (left > 0) {
    const last = order[order.length - 1]
    qty.set(last.component_id, (qty.get(last.component_id) ?? 0) + left)
  }
  const badTo =
    order.find((p) => (qty.get(p.component_id) ?? 0) > 0) ??
    order.find((p) => p.remaining - p.pending > 0) ??
    order[0]
  const res: ChiaRa[] = []
  let kgLeft = v.kg
  const withQty = order.filter((p) => (qty.get(p.component_id) ?? 0) > 0)
  for (const p of order) {
    const q = qty.get(p.component_id) ?? 0
    const isBad = p.component_id === badTo.component_id
    const defect = isBad ? Math.max(0, v.defect) : 0
    const rework = isBad ? Math.max(0, v.rework) : 0
    if (q <= 0 && defect <= 0 && rework <= 0) continue
    let kg: number | null = null
    if (v.kg != null && v.qty > 0 && q > 0) {
      const isLast = p.component_id === withQty[withQty.length - 1]?.component_id
      kg = isLast
        ? Math.round((kgLeft ?? 0) * 100) / 100
        : Math.round(((v.kg * q) / v.qty) * 100) / 100
      kgLeft = (kgLeft ?? 0) - kg
    }
    res.push({ component_id: p.component_id, dot: p.dot, qty: q, defect, rework, kg })
  }
  return res
}

/** "đợt 1: 108 · đợt 2: 12" — nói trên dòng đang gõ số sẽ rơi vào đâu. */
export function chiaText(c: ChiaRa[]): string {
  return c
    .filter((x) => x.qty > 0)
    .map((x) => `${(x.dot ?? 'đợt').toLowerCase()}: ${x.qty.toLocaleString('vi-VN')}`)
    .join(' · ')
}
