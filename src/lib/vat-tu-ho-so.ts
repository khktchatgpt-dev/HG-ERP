/**
 * HỒ SƠ VẬT TƯ (06/10/2026) — mã này mua ở NCC nào, giá bao nhiêu, lần cuối khi
 * nào; chưa mua lần nào thì NCC nào từng bán mã CÙNG NHÓM CON.
 *
 * NGUỒN DUY NHẤT LÀ DÒNG ĐƠN MUA — không có bảng khai tay (chủ dự án chốt: "tận
 * dụng các đơn hàng để biết"). Đo 06/10: 371/13.396 mã từng lên đơn; 5.815 mã
 * chưa mua nhưng có NCC bán mã cùng nhóm con (trung vị 3 NCC).
 *
 * Hàm THUẦN (server gom, màn hình tính) — để test được và để client không phải
 * import gì từ `@/modules`.
 */

/** Giá chỉ tính từ đơn ĐÃ RA KHỎI NHÀ — cùng luật `priceHistoryByMaterial`. */
export const DA_GUI_NCC: ReadonlySet<string> = new Set([
  'ordered',
  'confirmed',
  'in_transit',
  'partial',
  'received',
])

export type VtLine = {
  line_id: string
  po_id: string
  po_code: string
  status: string
  /** Ngày đặt (ordered_at), chưa gửi thì ngày lập — yyyy-mm-dd. */
  at: string
  supplier_id: string
  supplier_name: string
  lsx_code: string | null
  qty: number
  qty2: number | null
  unit2: string | null
  unit_price: number | null
  currency: string
  /** 'unit2' = giá tính theo ĐV quy đổi (kg, m³…), còn lại theo ĐVT. */
  price_basis: string | null
  note: string | null
  qty_received: number
  qty_open: number
}

export type VtGoiY = {
  supplier_id: string
  supplier_name: string
  /** Số mã CÙNG NHÓM CON (khác mã đang xem) NCC này đã bán. */
  n_codes: number
  last_at: string
  sample: { code: string; name: string }[]
}

export type VtHoSo = {
  vt: {
    id: string
    code: string
    name: string
    unit: string
    group_name: string | null
    sub_group: string | null
    spec: string | null
    price_unit: string | null
    shelf: string | null
    min_stock: number | null
    is_active: boolean
    on_hand: number
    default_supplier: { id: string; name: string } | null
  }
  lines: VtLine[]
  goi_y: VtGoiY[]
}

/** Đơn vị TÍNH GIÁ của dòng: giá theo ĐV quy đổi (kg, m³…) hay theo ĐVT. */
export const dvGia = (l: Pick<VtLine, 'price_basis' | 'unit2'>, unit: string) =>
  l.price_basis === 'unit2' && l.unit2 ? l.unit2 : unit

export type NccRow = {
  id: string
  name: string
  /** null = NCC mặc định của mã nhưng CHƯA bán mã này lần nào qua hệ thống. */
  last: VtLine | null
  /** Dòng ĐÃ GỬI NCC gần nhất có giá — null khi chưa có giá chốt. */
  priceLine: VtLine | null
  nDon: number
  qty: number
  open: number
}

/**
 * Một dòng = một NCC từng bán mã này, mới nhất trước. Số lượng / giá chỉ tính
 * đơn đã gửi NCC (đơn nháp chưa phải cam kết).
 *
 * NCC MẶC ĐỊNH chưa bán mã này lần nào vẫn được bày (cuối danh sách, `last`
 * null) — đo 06/10: NH-0513 đặt mặc định Nhôm Tiến Đạt, nhưng NCC thật sự bán
 * là Quang Minh và Đoàn Gia. Giấu đi thì không ai thấy mặc định đang trỏ sai.
 */
export function nccRows(
  lines: readonly VtLine[],
  defaultSupplier: { id: string; name: string } | null,
): NccRow[] {
  const by = new Map<string, VtLine[]>()
  for (const l of lines) by.set(l.supplier_id, [...(by.get(l.supplier_id) ?? []), l])
  const daBan = [...by.entries()]
    .map(([id, ls]): NccRow => {
      const sorted = [...ls].sort((a, b) => (a.at < b.at ? 1 : -1))
      const sent = sorted.filter((l) => DA_GUI_NCC.has(l.status))
      return {
        id,
        name: sorted[0].supplier_name,
        last: sorted[0],
        priceLine: sent.find((l) => l.unit_price != null) ?? null,
        nDon: new Set(sent.map((l) => l.po_id)).size,
        qty: sent.reduce((s, l) => s + l.qty, 0),
        open: sent.reduce((s, l) => s + l.qty_open, 0),
      }
    })
    .sort((a, b) => (a.last!.at < b.last!.at ? 1 : -1))
  const macDinh: NccRow[] =
    defaultSupplier && !by.has(defaultSupplier.id)
      ? [{ id: defaultSupplier.id, name: defaultSupplier.name, last: null, priceLine: null, nDon: 0, qty: 0, open: 0 }] // prettier-ignore
      : []
  return [...daBan, ...macDinh]
}

/**
 * NCC "RẺ NHẤT" — chỉ khi SO ĐƯỢC: ≥ 2 NCC có giá chốt, CÙNG loại tiền và CÙNG
 * đơn vị tính giá. Khác đơn vị (₫/cây với ₫/kg) mà vẫn gắn nhãn là so táo với cam.
 */
export function reNhatId(rows: readonly NccRow[], unit: string): string | null {
  const coGia = rows.filter((n) => n.priceLine?.unit_price != null)
  if (coGia.length < 2) return null
  const k = (n: NccRow) => `${n.priceLine!.currency}|${dvGia(n.priceLine!, unit)}`
  if (new Set(coGia.map(k)).size > 1) return null
  return coGia.reduce((a, b) =>
    b.priceLine!.unit_price! < a.priceLine!.unit_price! ? b : a,
  ).id
}

/** Các số đầu trang — mọi số đều đếm trên dòng ĐÃ GỬI NCC. */
export function tomTat(lines: readonly VtLine[]) {
  const daGui = lines.filter((l) => DA_GUI_NCC.has(l.status))
  const sorted = [...daGui].sort((a, b) => (a.at < b.at ? 1 : -1))
  return {
    ganNhat: sorted.find((l) => l.unit_price != null) ?? null,
    daDat: daGui.reduce((s, l) => s + l.qty, 0),
    dangVe: daGui.reduce((s, l) => s + l.qty_open, 0),
    nDon: new Set(daGui.map((l) => l.po_id)).size,
    donDangVe: new Set(daGui.filter((l) => l.qty_open > 0).map((l) => l.po_id)).size,
  }
}

/** Một dòng đơn của mã CÙNG NHÓM CON — đầu vào của `gomGoiY`. */
export type DongCungNhom = {
  supplier_id: string
  supplier_name: string
  code: string
  name: string
  at: string
}

/**
 * NCC GỢI Ý — từng bán mã cùng nhóm con, CHƯA bán mã đang xem. Nhiều mã cùng
 * nhóm trước, cùng số thì mới mua gần đây trước. Ví dụ tối đa 3 mã.
 */
export function gomGoiY(
  rows: readonly DongCungNhom[],
  daBan: ReadonlySet<string>,
): VtGoiY[] {
  const by = new Map<string, { name: string; codes: Map<string, string>; last: string }>()
  for (const r of rows) {
    if (daBan.has(r.supplier_id)) continue
    const g = by.get(r.supplier_id) ?? {
      name: r.supplier_name,
      codes: new Map(),
      last: r.at,
    }
    g.codes.set(r.code, r.name)
    if (r.at > g.last) g.last = r.at
    by.set(r.supplier_id, g)
  }
  return [...by.entries()]
    .map(([supplier_id, g]) => ({
      supplier_id,
      supplier_name: g.name,
      n_codes: g.codes.size,
      last_at: g.last,
      sample: [...g.codes.entries()].slice(0, 3).map(([code, name]) => ({ code, name })),
    }))
    .sort((a, b) => b.n_codes - a.n_codes || (a.last_at < b.last_at ? 1 : -1))
}
