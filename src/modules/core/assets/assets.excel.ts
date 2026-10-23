import ExcelJS from 'exceljs'
import type { GroupRow } from './assets.repo'
import type { AssetCreateInput } from './assets.schema'

/**
 * EXCEL khu Máy móc: file mẫu để Tổ Cơ điện điền danh sách máy, đọc file đó khi
 * nhập, và xuất bảng chi phí tháng cho kế toán. Thuần (không DB) để test được.
 *
 * Cột nhận theo TIÊU ĐỀ (bỏ dấu, không phân biệt hoa thường) chứ không theo vị
 * trí: người điền hay chèn / xoá cột, khớp theo vị trí là nhập lệch cả bảng.
 */

export const IMPORT_COLS = [
  { key: 'name', title: 'Tên máy / dụng cụ *', width: 36 },
  { key: 'group', title: 'Mã nhóm *', width: 12 },
  { key: 'model', title: 'Model / hãng', width: 22 },
  { key: 'serial', title: 'Số serial', width: 18 },
  { key: 'supplier', title: 'Nhà cung cấp', width: 24 },
  { key: 'dept', title: 'Đặt tại (tổ)', width: 22 },
  { key: 'resp', title: 'Mã NV phụ trách', width: 16 },
  { key: 'use_date', title: 'Ngày đưa vào dùng', width: 18 },
  { key: 'cost', title: 'Giá mua (đ)', width: 16 },
  { key: 'hpd', title: 'Giờ chạy / ngày', width: 14 },
  { key: 'note', title: 'Ghi chú', width: 30 },
] as const
type ColKey = (typeof IMPORT_COLS)[number]['key']

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export async function buildTemplate(
  groups: Pick<GroupRow, 'id' | 'name' | 'kind'>[],
  depts: { name: string }[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Máy móc')
  ws.columns = IMPORT_COLS.map((c) => ({ header: c.title, key: c.key, width: c.width }))
  ws.getRow(1).font = { bold: true }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.addRow({
    name: 'Máy hàn MIG 350A',
    group: 'HAN',
    model: 'Jasic NBC-350',
    serial: 'JS23-04417',
    supplier: 'Hàn Việt',
    dept: 'Tổ Hàn',
    resp: '441',
    use_date: '15/03/2025',
    cost: 18500000,
    hpd: 0,
    note: 'Dòng ví dụ — xoá trước khi nhập',
  })
  const g = wb.addWorksheet('Mã nhóm')
  g.columns = [
    { header: 'Mã nhóm', key: 'id', width: 10 },
    { header: 'Tên nhóm', key: 'name', width: 52 },
    { header: 'Loại', key: 'kind', width: 12 },
  ]
  g.getRow(1).font = { bold: true }
  for (const x of groups)
    g.addRow({ id: x.id, name: x.name, kind: x.kind === 'machine' ? 'Máy' : 'Dụng cụ' })
  const d = wb.addWorksheet('Tổ')
  d.columns = [{ header: 'Tên tổ / phòng (ghi đúng như dưới)', key: 'name', width: 40 }]
  d.getRow(1).font = { bold: true }
  for (const x of depts) d.addRow({ name: x.name })
  return Buffer.from(await wb.xlsx.writeBuffer())
}

export type ImportRow = {
  row: number
  input: AssetCreateInput | null
  errors: string[]
  /** Dữ liệu thô để bày lại cho người duyệt. */
  raw: Record<ColKey, string>
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return ''
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${p(v.getUTCDate())}/${p(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`
  }
  if (typeof v === 'object') {
    if ('text' in v && typeof v.text === 'string') return v.text.trim()
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue)
    if ('richText' in v)
      return v.richText
        .map((r) => r.text)
        .join('')
        .trim()
    return ''
  }
  return String(v).trim()
}

/** "15/03/2025" | "2025-03-15" → ISO; rỗng → null; sai → undefined. */
export function parseDate(s: string): string | null | undefined {
  if (!s) return null
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s)
  if (m) {
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
    const t = new Date(Date.UTC(y, mo - 1, d))
    if (t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return undefined
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? s : undefined
}

/** Số kiểu VN: "18.500.000" = 18500000, "2,5" = 2.5. */
export function parseVnNumber(s: string): number | null | undefined {
  if (!s) return null
  const t = s.replace(/\s|đ|vnd/gi, '')
  const norm = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)
    ? t.replace(/\./g, '').replace(',', '.')
    : t.replace(',', '.')
  const n = Number(norm)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export async function parseImport(
  buffer: ArrayBuffer,
  groups: Pick<GroupRow, 'id' | 'kind' | 'active'>[],
  depts: { id: string; name: string }[],
  employees: { id: string; code: string; active: boolean }[],
): Promise<{ rows: ImportRow[]; missingCols: string[] }> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets[0]
  if (!ws) return { rows: [], missingCols: ['(file không có trang tính)'] }
  const head = new Map<ColKey, number>()
  ws.getRow(1).eachCell((cell, col) => {
    const t = fold(cellText(cell.value))
    for (const c of IMPORT_COLS)
      if (
        !head.has(c.key) &&
        t &&
        fold(c.title).startsWith(t.split(' ').slice(0, 2).join(' '))
      )
        head.set(c.key, col)
  })
  const missingCols = IMPORT_COLS.filter(
    (c) => c.title.endsWith('*') && !head.has(c.key),
  ).map((c) => c.title)
  if (missingCols.length) return { rows: [], missingCols }

  const groupBy = new Map(
    groups.filter((g) => g.active).map((g) => [g.id.toUpperCase(), g]),
  )
  const deptBy = new Map(depts.map((d) => [fold(d.name), d.id]))
  const empBy = new Map(
    employees.filter((e) => e.active).map((e) => [e.code.trim(), e.id]),
  )
  const rows: ImportRow[] = []
  ws.eachRow((r, n) => {
    if (n === 1) return
    const raw = Object.fromEntries(
      IMPORT_COLS.map((c) => [
        c.key,
        head.has(c.key) ? cellText(r.getCell(head.get(c.key)!).value) : '',
      ]),
    ) as Record<ColKey, string>
    if (Object.values(raw).every((v) => !v)) return
    if (/^dòng ví dụ/i.test(raw.note)) return
    const errors: string[] = []
    const g = groupBy.get(raw.group.toUpperCase())
    if (raw.name.length < 2) errors.push('Thiếu tên')
    if (!g) errors.push(`Mã nhóm "${raw.group}" không có — xem trang "Mã nhóm"`)
    const deptId = raw.dept ? deptBy.get(fold(raw.dept)) : null
    if (raw.dept && !deptId) errors.push(`Tổ "${raw.dept}" không có — xem trang "Tổ"`)
    const resp = raw.resp ? empBy.get(raw.resp) : null
    if (raw.resp && !resp) errors.push(`Mã NV "${raw.resp}" không có hoặc đã nghỉ`)
    const useDate = parseDate(raw.use_date)
    if (useDate === undefined) errors.push(`Ngày "${raw.use_date}" sai — ghi dd/mm/yyyy`)
    const cost = parseVnNumber(raw.cost)
    if (cost === undefined) errors.push(`Giá "${raw.cost}" không phải số`)
    const hpd = parseVnNumber(raw.hpd)
    if (hpd === undefined || (hpd != null && hpd > 24))
      errors.push(`Giờ chạy/ngày "${raw.hpd}" phải từ 0 tới 24`)
    rows.push({
      row: n,
      raw,
      errors,
      input:
        errors.length || !g
          ? null
          : {
              name: raw.name,
              group_id: g.id,
              model: raw.model || null,
              serial: raw.serial || null,
              supplier: raw.supplier || null,
              department_id: deptId ?? null,
              resp_employee_id: resp ?? null,
              use_date: useDate ?? null,
              purchase_date: useDate ?? null,
              cost: cost ?? 0,
              hours_per_day: g.kind === 'machine' ? (hpd ?? 0) : 0,
              qty: 1,
              note: raw.note || null,
            },
    })
  })
  return { rows, missingCols: [] }
}

/** Bảng chi phí tháng cho kế toán (cùng cột với bảng trên màn). */
export async function buildCostSheet(
  month: string,
  rows: {
    done_on: string
    no: string
    asset_code: string
    asset_name: string
    dept_name: string | null
    kind_label: string
    title: string
    parts: { name: string; qty: number }[]
    downtime_hours: number
    cost: number
  }[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(`Chi phí ${month}`)
  ws.columns = [
    { header: 'Ngày', key: 'd', width: 12 },
    { header: 'Số phiếu', key: 'no', width: 12 },
    { header: 'Mã máy', key: 'code', width: 14 },
    { header: 'Tên máy', key: 'name', width: 32 },
    { header: 'Tổ', key: 'dept', width: 18 },
    { header: 'Loại', key: 'kind', width: 12 },
    { header: 'Nội dung', key: 'title', width: 36 },
    { header: 'Vật tư', key: 'parts', width: 36 },
    { header: 'Giờ dừng', key: 'down', width: 10 },
    { header: 'Chi phí (đ)', key: 'cost', width: 16 },
  ]
  ws.getRow(1).font = { bold: true }
  for (const r of rows) {
    const [y, m, d] = r.done_on.split('-')
    ws.addRow({
      d: `${d}/${m}/${y}`,
      no: r.no,
      code: r.asset_code,
      name: r.asset_name,
      dept: r.dept_name ?? '',
      kind: r.kind_label,
      title: r.title,
      parts: r.parts.map((p) => `${p.name} ×${p.qty}`).join('; '),
      down: r.downtime_hours,
      cost: r.cost,
    })
  }
  const total = ws.addRow({
    title: `Tổng ${rows.length} phiếu`,
    down: rows.reduce((s, r) => s + r.downtime_hours, 0),
    cost: rows.reduce((s, r) => s + r.cost, 0),
  })
  total.font = { bold: true }
  ws.getColumn('cost').numFmt = '#,##0'
  return Buffer.from(await wb.xlsx.writeBuffer())
}
