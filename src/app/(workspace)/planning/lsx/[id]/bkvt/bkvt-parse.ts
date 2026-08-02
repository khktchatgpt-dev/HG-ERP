/**
 * Đọc lưới ô của sheet BKVT trong file LSX của phòng Cung ứng.
 *
 * Bám theo TIÊU ĐỀ CỘT chứ không theo vị trí: 8 file thật đặt cột lệch nhau và
 * đặt tên khác nhau ("SL/ĐH" vs "SL", "Đm/sp" vs "đm/sp", "SL dặt hàng" — gõ
 * thiếu dấu). Đối chiếu vị trí cột là hỏng ngay ở file thứ hai.
 *
 * Mã SP chỉ ghi ở dòng đầu mỗi khối sản phẩm rồi bỏ trống các dòng sau (xem
 * BKVT của LSX 04) → nhớ giá trị gần nhất, nếu không 6 dòng tiếp mất luôn sản
 * phẩm và không truy được định mức thuộc về SP nào.
 *
 * Hàm thuần, không đụng DOM/DB — phần khớp vật tư & NCC nằm ở service.
 */

export type BkvtParsedRow = {
  product_code: string | null
  product_name: string | null
  material_name: string
  unit: string | null
  qty_per_product: number | null
  product_qty: number | null
  qty_required: number | null
  qty_on_hand: number | null
  qty_to_order: number | null
  unit_price: number | null
  supplier_label: string | null
  note: string | null
}

const norm = (v: unknown) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu
    .replace(/đ/gi, 'd')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

/**
 * Số kiểu bảng tính: "1,200" là ngăn nghìn, "5.5" là thập phân. Ô chữ ("Gộp 3
 * dòng", "-") trả null chứ không thành 0 — 0 nghĩa là "không cần mua", khác hẳn
 * "chưa điền".
 */
function num(v: string): number | null {
  const s = v.replace(/\s/g, '').replace(/,/g, '')
  if (!s || !/^-?\d*\.?\d+$/.test(s)) return null
  const x = Number(s)
  return Number.isFinite(x) ? x : null
}

export function parseBkvt(grid: string[][]): BkvtParsedRow[] {
  const headerIdx = grid.findIndex((row) => row.some((c) => /ten vat tu/.test(norm(c))))
  if (headerIdx < 0) return []
  const header = grid[headerIdx].map(norm)
  const find = (...pats: RegExp[]) =>
    header.findIndex((h) => h && pats.some((p) => p.test(h)))

  const col = {
    product_code: find(/^ma sp/),
    product_name: find(/^ten sp/),
    material_name: find(/ten vat tu/),
    unit: find(/^dvt$/, /^don vi/),
    dm: find(/^dm\/sp/, /dinh muc\/sp/),
    qty: find(/^sl$/, /^sl\/dh/, /^so luong$/),
    note: find(/^vtrl/, /ghi chu/),
    required: find(/sl dat hang/, /sl dat$/),
    on_hand: find(/^ton/),
    to_order: find(/sl can dat/),
    price: find(/^dgia/, /^don gia/),
    supplier: find(/^ncc$/, /nha cung cap/),
  }
  if (col.material_name < 0) return []

  const cell = (row: string[], i: number) => (i < 0 ? '' : String(row[i] ?? '').trim())

  let lastCode = ''
  let lastName = ''
  const out: BkvtParsedRow[] = []
  for (const row of grid.slice(headerIdx + 1)) {
    const name = cell(row, col.material_name)
    if (!name) continue
    if (/^tong|^cong$/.test(norm(name))) continue // dòng tổng cộng cuối bảng
    const code = cell(row, col.product_code)
    const pname = cell(row, col.product_name)
    if (code) lastCode = code
    if (pname) lastName = pname
    out.push({
      product_code: lastCode || null,
      product_name: lastName || null,
      material_name: name,
      unit: cell(row, col.unit) || null,
      qty_per_product: num(cell(row, col.dm)),
      product_qty: num(cell(row, col.qty)),
      qty_required: num(cell(row, col.required)),
      qty_on_hand: num(cell(row, col.on_hand)),
      qty_to_order: num(cell(row, col.to_order)),
      unit_price: num(cell(row, col.price)),
      supplier_label: cell(row, col.supplier) || null,
      note: cell(row, col.note) || null,
    })
  }
  return out
}
