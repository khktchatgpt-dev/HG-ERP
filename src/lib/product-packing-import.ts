import { fold, parseBoolCell, parseNumberCell, type CellValue } from './product-import'

/**
 * SHEET "ĐÓNG GÓI" của file thêm + cập nhật SP (08/10/2026) — phương án đóng gói
 * NHIỀU KIỆN (`technical_packing_options` + `technical_packages`). Luật thuần.
 *
 * Đo 07/10: 197 phương án / 168 SP / 128 kiện; 113 phương án không kiện nào (chỉ
 * số thùng/bộ + xếp cont); tới 5 kiện một phương án; 3 chỗ hai kiện TRÙNG TÊN
 * trong một phương án (nên không khoá kiện theo tên).
 *
 * Cấu trúc nhiều dòng không dùng được luật "ô trống = giữ nguyên" của sheet Sản
 * phẩm, nên: SP NÀO CÓ MẶT trong sheet thì đóng gói của SP đó được THAY TRỌN BỘ
 * bằng nội dung sheet; SP vắng mặt không đụng. Gõ "-" ở ô "Phương án số" = xoá
 * hết phương án của SP đó. (Cùng cách thay định mức bằng file BOM — `ai-apply`.)
 *
 * Mỗi dòng là MỘT KIỆN; ô của phương án (số, tên, mặc định, thùng/bộ, xếp cont,
 * ghi chú) lặp lại trên các dòng kiện của nó. Phương án không kiện = một dòng,
 * để trống phần kiện.
 */

export const PACKING_SHEET = 'Đóng gói'

type Kind = 'code' | 'optno' | 'text' | 'bool' | 'int' | 'num'
export type PackingColumn = {
  key: string
  header: string
  kind: Kind
  level: 'option' | 'package' | 'code'
  max?: number
  width: number
  note?: string
}

export const PACKING_COLUMNS: PackingColumn[] = [
  { key: 'code', header: 'Mã nội bộ', kind: 'code', level: 'code', width: 15, note: 'SP đã có trong thư viện' }, // prettier-ignore
  { key: 'option_no', header: 'Phương án số', kind: 'optno', level: 'option', width: 9, note: '1, 2… · "-" = xoá hết' }, // prettier-ignore
  { key: 'label', header: 'Tên phương án', kind: 'text', level: 'option', max: 300, width: 30, note: 'vd "Op2: không tháo rời"' }, // prettier-ignore
  { key: 'is_default', header: 'Mặc định', kind: 'bool', level: 'option', width: 9, note: 'có / không' }, // prettier-ignore
  {
    key: 'cartons_per_set',
    header: 'Số thùng / bộ',
    kind: 'int',
    level: 'option',
    width: 9,
  },
  {
    key: 'loading_40hc',
    header: 'Xếp cont 40HC (bộ)',
    kind: 'int',
    level: 'option',
    width: 11,
  },
  { key: 'note', header: 'Ghi chú phương án', kind: 'text', level: 'option', max: 500, width: 20 }, // prettier-ignore
  { key: 'package_label', header: 'Tên kiện', kind: 'text', level: 'package', max: 200, width: 22, note: 'Trống = phương án không kiện' }, // prettier-ignore
  {
    key: 'qty',
    header: 'SL kiện',
    kind: 'int',
    level: 'package',
    width: 7,
    note: 'Trống = 1',
  },
  {
    key: 'carton_l_mm',
    header: 'Thùng dài (mm)',
    kind: 'num',
    level: 'package',
    width: 10,
  },
  {
    key: 'carton_w_mm',
    header: 'Thùng rộng (mm)',
    kind: 'num',
    level: 'package',
    width: 10,
  },
  {
    key: 'carton_h_mm',
    header: 'Thùng cao (mm)',
    kind: 'num',
    level: 'package',
    width: 10,
  },
  {
    key: 'net_weight_kg',
    header: 'NW kiện (kg)',
    kind: 'num',
    level: 'package',
    width: 9,
  },
  {
    key: 'gross_weight_kg',
    header: 'GW kiện (kg)',
    kind: 'num',
    level: 'package',
    width: 9,
  },
]

export function packingColumnForHeader(header: string): PackingColumn | null {
  const h = fold(header).replace(/\s*\*$/, '')
  return PACKING_COLUMNS.find((c) => fold(c.header) === h) ?? null
}

export type PackageData = {
  package_label: string
  qty: number
  carton_l_mm: number | null
  carton_w_mm: number | null
  carton_h_mm: number | null
  net_weight_kg: number | null
  gross_weight_kg: number | null
}
export type OptionData = {
  option_no: number
  label: string | null
  is_default: boolean
  cartons_per_set: number | null
  loading_40hc: number | null
  note: string | null
  packages: PackageData[]
}

export type PackingRawRow = { row: number; cells: Record<string, CellValue> }
export type PackingProductRef = { id: string; code: string; locked_at: string | null }

export type PackingPlanItem = {
  code: string
  productId: string | null
  /** Hàng Excel thuộc SP này — để màn soi chỉ đúng chỗ. */
  rows: number[]
  action: 'replace' | 'same' | 'error'
  options: OptionData[]
  /** "2 phương án · 3 kiện" của bản cũ / bản mới. */
  before: string
  after: string
  errors: { row?: number; msg: string }[]
}
export type PackingPlan = {
  items: PackingPlanItem[]
  counts: { products: number; replace: number; same: number; error: number }
}

/** Tóm tắt một bộ phương án cho màn soi. */
export function packingSummary(opts: readonly OptionData[]): string {
  if (!opts.length) return '(không có phương án)'
  const pk = opts.reduce((s, o) => s + o.packages.length, 0)
  const def = opts.find((o) => o.is_default)
  const load = def?.loading_40hc
    ? ` · mặc định PA${def.option_no}: ${def.loading_40hc} bộ/40HC`
    : ''
  return `${opts.length} phương án · ${pk} kiện${load}`
}

/** Dạng chuẩn để so hai bộ — số so bằng số, thứ tự theo số phương án / thứ tự kiện. */
function canon(opts: readonly OptionData[]): string {
  const n = (v: number | null) => (v == null ? null : Number(v))
  return JSON.stringify(
    [...opts]
      .sort((a, b) => a.option_no - b.option_no)
      .map((o) => [
        o.option_no,
        o.label ?? null,
        o.is_default,
        n(o.cartons_per_set),
        n(o.loading_40hc),
        o.note ?? null,
        o.packages.map((p) => [
          p.package_label,
          n(p.qty),
          n(p.carton_l_mm),
          n(p.carton_w_mm),
          n(p.carton_h_mm),
          n(p.net_weight_kg),
          n(p.gross_weight_kg),
        ]),
      ]),
  )
}

/**
 * Lập kế hoạch sheet Đóng gói: gom dòng theo SP → phương án → kiện, kiểm, so với
 * bản đang có. `newCodes` = mã của SP vừa THÊM MỚI ở sheet Sản phẩm (chưa có id):
 * dòng đóng gói trỏ tới chúng được ghi SAU khi SP được tạo.
 */
export function planPacking(
  input: readonly PackingRawRow[],
  products: readonly PackingProductRef[],
  existing: ReadonlyMap<string, OptionData[]>,
): PackingPlan {
  const byCode = new Map(products.map((p) => [p.code.toUpperCase(), p]))
  const groups = new Map<string, PackingRawRow[]>()
  const orphan: PackingPlanItem[] = []
  for (const r of input) {
    const code = String(r.cells.code ?? '')
      .trim()
      .toUpperCase()
    if (!code) {
      orphan.push({ code: '', productId: null, rows: [r.row], action: 'error', options: [], before: '', after: '', errors: [{ row: r.row, msg: 'Thiếu Mã nội bộ — dòng đóng gói phải ghi SP nào' }] }) // prettier-ignore
      continue
    }
    groups.set(code, [...(groups.get(code) ?? []), r])
  }

  const items: PackingPlanItem[] = [...orphan]
  for (const [code, rows] of groups) {
    const errors: { row?: number; msg: string }[] = []
    const p = byCode.get(code)
    const err = (row: number | undefined, msg: string) => errors.push({ row, msg })
    if (!p) err(rows[0].row, `Mã "${code}" không có trong thư viện — SP mới thì ghi sheet Sản phẩm trước, tải file đã có mã rồi điền đóng gói`) // prettier-ignore
    if (p?.locked_at)
      err(rows[0].row, 'Hồ sơ đã khoá — mở khoá ở trang chi tiết rồi tải lại file')

    const num = (r: PackingRawRow, key: string, kind: 'int' | 'num'): number | null => {
      const v = r.cells[key]
      if (v == null || v === '') return null
      const n = parseNumberCell(v)
      const label = PACKING_COLUMNS.find((c) => c.key === key)!.header
      if (n == null || n <= 0)
        return (err(r.row, `${label} "${v}" phải là số lớn hơn 0`), null)
      if (kind === 'int' && !Number.isInteger(n)) return err(r.row, `${label} phải là số nguyên`), null // prettier-ignore
      return n
    }
    const text = (r: PackingRawRow, key: string): string | null => {
      const v = String(r.cells[key] ?? '').trim()
      const c = PACKING_COLUMNS.find((x) => x.key === key)!
      if (c.max && v.length > c.max) err(r.row, `${c.header} dài quá ${c.max} ký tự`)
      return v || null
    }

    // "-" ở ô Phương án số = xoá hết phương án của SP.
    const clear = rows.some((r) => String(r.cells.option_no ?? '').trim() === '-')
    const options = new Map<
      number,
      OptionData & { firstRow: number; defaultSeen: boolean | null }
    >()
    if (clear && rows.length > 1) err(rows[0].row, 'Đã gõ "-" (xoá hết) thì SP này chỉ được MỘT dòng đóng gói') // prettier-ignore
    if (!clear) {
      for (const r of rows) {
        const rawNo = r.cells.option_no
        const no = rawNo === '' || rawNo == null ? 1 : parseNumberCell(rawNo)
        if (no == null || no < 1 || !Number.isInteger(no)) {
          err(r.row, `Phương án số "${rawNo}" phải là số nguyên từ 1`)
          continue
        }
        const optFields = {
          label: text(r, 'label'),
          is_default: r.cells.is_default === '' || r.cells.is_default == null ? null : parseBoolCell(r.cells.is_default), // prettier-ignore
          cartons_per_set: num(r, 'cartons_per_set', 'int'),
          loading_40hc: num(r, 'loading_40hc', 'int'),
          note: text(r, 'note'),
        }
        if (
          r.cells.is_default !== '' &&
          r.cells.is_default != null &&
          optFields.is_default == null
        ) {
          err(r.row, `Mặc định "${r.cells.is_default}" — gõ "có" hoặc "không"`)
        }
        let o = options.get(no)
        if (!o) {
          o = { option_no: no, label: null, is_default: false, cartons_per_set: null, loading_40hc: null, note: null, packages: [], firstRow: r.row, defaultSeen: null } // prettier-ignore
          options.set(no, o)
        }
        // Ô của phương án lặp lại trên mỗi dòng kiện: dòng sau để trống = lấy dòng
        // trước; ghi KHÁC dòng trước = lỗi (không đoán dòng nào đúng).
        for (const k of ['label', 'cartons_per_set', 'loading_40hc', 'note'] as const) {
          const v = optFields[k]
          if (v == null) continue
          if (o[k] != null && o[k] !== v) {
            err(r.row, `Phương án ${no} ghi khác dòng ${o.firstRow} ở ô "${PACKING_COLUMNS.find((c) => c.key === k)!.header}"`) // prettier-ignore
            continue
          }
          ;(o as Record<string, unknown>)[k] = v
        }
        if (optFields.is_default != null) {
          if (o.defaultSeen != null && o.defaultSeen !== optFields.is_default) {
            err(r.row, `Phương án ${no} ghi "Mặc định" khác dòng ${o.firstRow}`)
          }
          o.defaultSeen = optFields.is_default
          o.is_default = o.is_default || optFields.is_default
        }

        const label = text(r, 'package_label')
        const pkgNums = {
          qty: num(r, 'qty', 'int'),
          carton_l_mm: num(r, 'carton_l_mm', 'num'),
          carton_w_mm: num(r, 'carton_w_mm', 'num'),
          carton_h_mm: num(r, 'carton_h_mm', 'num'),
          net_weight_kg: num(r, 'net_weight_kg', 'num'),
          gross_weight_kg: num(r, 'gross_weight_kg', 'num'),
        }
        const anyPkg = Object.values(pkgNums).some((v) => v != null)
        if (!label && anyPkg)
          err(r.row, 'Có kích thước / số lượng kiện mà thiếu Tên kiện')
        if (label) o.packages.push({ package_label: label, ...pkgNums, qty: pkgNums.qty ?? 1 })
        else if (o.firstRow !== r.row && !anyPkg) err(r.row, `Phương án ${no} đã có dòng ${o.firstRow} — dòng không kiện chỉ được một dòng`) // prettier-ignore
      }
    }

    const list = [...options.values()].sort((a, b) => a.option_no - b.option_no)
    const defaults = list.filter((o) => o.is_default)
    if (defaults.length > 1) err(rows[0].row, `SP có ${defaults.length} phương án đánh dấu Mặc định — chỉ được một`) // prettier-ignore
    if (list.length && defaults.length === 0) list[0].is_default = true
    const opts: OptionData[] = list.map((o) => ({
      option_no: o.option_no,
      label: o.label,
      is_default: o.is_default,
      cartons_per_set: o.cartons_per_set,
      loading_40hc: o.loading_40hc,
      note: o.note,
      packages: o.packages,
    }))

    const old = p ? (existing.get(p.id) ?? []) : []
    const same = !errors.length && canon(old) === canon(opts)
    items.push({
      code,
      productId: p?.id ?? null,
      rows: rows.map((r) => r.row),
      action: errors.length ? 'error' : same ? 'same' : 'replace',
      options: opts,
      before: packingSummary(old),
      after: clear ? '(xoá hết phương án)' : packingSummary(opts),
      errors,
    })
  }
  return {
    items,
    counts: {
      products: items.length,
      replace: items.filter((i) => i.action === 'replace').length,
      same: items.filter((i) => i.action === 'same').length,
      error: items.filter((i) => i.action === 'error').length,
    },
  }
}
