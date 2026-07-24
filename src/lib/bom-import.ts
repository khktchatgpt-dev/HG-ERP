/**
 * Import bảng chi tiết từ file BOM (Excel/CSV/dán từ Excel) — logic THUẦN cho
 * màn Định hình (0084): tách ô, đoán cột theo tiêu đề tiếng Việt, khớp vật tư
 * theo mã/tên. UI chỉ việc gọi — có test (NFR-QA-01).
 *
 * Nguyên tắc: import chỉ ĐIỀN SẴN vào lưới (như "Gợi ý từ BOM") — thống kê rà
 * từng dòng rồi mới Lưu; không ghi DB trực tiếp.
 */

/** Trường đích của 1 dòng chi tiết (khớp EditRow của LsxComponentsPanel). */
export type BomField =
  | 'cluster'
  | 'name'
  | 'material'
  | 'material_type'
  | 'spec_thickness_mm'
  | 'spec_width_mm'
  | 'spec_length_mm'
  | 'qty_per_unit'
  | 'dm_kg'
  | 'pcs_per_bar'
  | 'note'
  | 'skip'

export const BOM_FIELD_LABELS: Record<BomField, string> = {
  cluster: 'Cụm',
  name: 'Tên chi tiết',
  material: 'Vật tư (mã/tên)',
  material_type: 'Loại VT',
  spec_thickness_mm: 'Dày (mm)',
  spec_width_mm: 'Rộng/Ø (mm)',
  spec_length_mm: 'Dài (mm)',
  qty_per_unit: 'CT/SP',
  dm_kg: 'ĐM kg',
  pcs_per_bar: 'CT/cây',
  note: 'Ghi chú',
  skip: '— bỏ cột —',
}

/**
 * Tách bảng từ text dán từ Excel (TSV) hoặc file CSV. Tab thắng nếu có
 * (dán từ Excel luôn là tab); CSV xử lý ô trong ngoặc kép "a,b".
 */
export function parseDelimited(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const hasTab = lines.some((l) => l.includes('\t'))
  const rows: string[][] = []
  for (const line of lines) {
    if (!line.trim()) continue
    if (hasTab) {
      rows.push(line.split('\t').map((c) => c.trim()))
      continue
    }
    // CSV tối giản: ngoặc kép chỉ mở Ở ĐẦU Ô (RFC 4180); "" trong ô quoted = 1
    // dấu "; dấu " giữa ô không quoted là ký tự thường.
    const cells: string[] = []
    let cur = ''
    let inQ = false
    let atCellStart = true
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"'
          i++
        } else if (ch === '"') inQ = false
        else cur += ch
      } else if (ch === '"' && atCellStart) {
        inQ = true
        atCellStart = false
      } else if (ch === ',') {
        cells.push(cur.trim())
        cur = ''
        atCellStart = true
        continue
      } else {
        cur += ch
        atCellStart = false
      }
    }
    cells.push(cur.trim())
    rows.push(cells)
  }
  return rows
}

/** Bỏ dấu tiếng Việt + thường hoá — so khớp tiêu đề/mã không phụ thuộc dấu. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

/** Luật đoán cột theo tiêu đề (thứ tự ưu tiên — luật trước thắng). */
const HEADER_RULES: [BomField, RegExp][] = [
  ['cluster', /\bcum\b|cụm/],
  ['qty_per_unit', /ct\s*\/\s*sp|sl\s*\/\s*sp|so luong\s*\/|cai\s*\/\s*sp|\bctsp\b/],
  ['pcs_per_bar', /\/\s*cay|ct\s*\/\s*c|so ct.*cay|\bcay\b/],
  ['dm_kg', /dinh muc|dm.*kg|\bkg\b/],
  ['spec_thickness_mm', /\bday\b|do day/],
  ['spec_width_mm', /\brong\b|do rong|\bphi\b|ø/],
  ['spec_length_mm', /\bdai\b|do dai|chieu dai/],
  ['material_type', /loai vt|loai vat tu|hinh dang|quy cach|\bloai\b/],
  ['material', /vat tu|ma vt|material|\bvt\b/],
  ['name', /chi tiet|ten|detail|part/],
  ['note', /ghi chu|note|luu y/],
]

export function guessField(header: string): BomField {
  const h = normalize(header)
  if (!h) return 'skip'
  for (const [field, re] of HEADER_RULES) {
    if (re.test(h)) return field
  }
  return 'skip'
}

/**
 * Dòng đầu có phải tiêu đề không: đoán được ≥2 cột VÀ không phải dòng số liệu
 * (tiêu đề hiếm khi có ô thuần số).
 */
export function looksLikeHeader(row: string[]): boolean {
  const guessed = row.filter((c) => guessField(c) !== 'skip').length
  const numeric = row.filter((c) => c !== '' && !Number.isNaN(Number(c))).length
  return guessed >= 2 && numeric === 0
}

export type MaterialOpt = { id: string; code: string; name: string }

/**
 * Khớp text vật tư trong file → material_id: ưu tiên trùng MÃ (không dấu,
 * không phân hoa thường), rồi tên chứa/bị chứa. Không khớp → null (dòng vẫn
 * import, người nhập gắn tay).
 */
export function matchMaterial(text: string, materials: MaterialOpt[]): string | null {
  const t = normalize(text)
  if (!t) return null
  const byCode = materials.find((m) => normalize(m.code) === t)
  if (byCode) return byCode.id
  const byCodeIn = materials.find(
    (m) => t.includes(normalize(m.code)) && m.code.length >= 4,
  )
  if (byCodeIn) return byCodeIn.id
  const byName = materials.find((m) => {
    const n = normalize(m.name)
    return n === t || n.includes(t) || t.includes(n)
  })
  return byName?.id ?? null
}

/** Số kiểu Việt trong Excel: "1.234,5" / "1,5" / "12" → number; rác → ''. */
export function parseNum(s: string): number | '' {
  const t = s.trim().replace(/\s/g, '')
  if (!t) return ''
  // Có cả . và , → chấm là phân cách nghìn kiểu VN; chỉ có , → , là thập phân.
  const canon =
    t.includes('.') && t.includes(',')
      ? t.replace(/\./g, '').replace(',', '.')
      : t.replace(',', '.')
  const n = Number(canon)
  return Number.isFinite(n) ? n : ''
}

export type ImportedRow = {
  cluster: string
  name: string
  material_id: string
  material_text: string
  material_type: string
  spec_thickness_mm: number | ''
  spec_width_mm: number | ''
  spec_length_mm: number | ''
  qty_per_unit: number | ''
  dm_kg: number | ''
  pcs_per_bar: number | ''
  note: string
}

/**
 * Lắp dòng import từ ma trận ô + mapping cột. Bỏ dòng không có tên chi tiết.
 * Vật tư không khớp danh mục → material_id rỗng + giữ text trong ghi chú để
 * người nhập biết file ghi gì.
 */
export function buildImportedRows(
  cells: string[][],
  mapping: BomField[],
  materials: MaterialOpt[],
): { rows: ImportedRow[]; unmatched_materials: number } {
  const rows: ImportedRow[] = []
  let unmatched = 0
  let lastCluster = '' // file thật hay gộp ô cụm — dòng dưới bỏ trống nghĩa là cùng cụm
  for (const line of cells) {
    const get = (f: BomField) => {
      const idx = mapping.indexOf(f)
      return idx >= 0 ? (line[idx] ?? '').trim() : ''
    }
    const name = get('name')
    if (!name) continue
    const cluster = get('cluster') || lastCluster
    if (get('cluster')) lastCluster = get('cluster')
    const matText = get('material')
    const matId = matchMaterial(matText, materials)
    if (matText && !matId) unmatched++
    const noteBits = [get('note')]
    if (matText && !matId) noteBits.push(`VT file: ${matText}`)
    rows.push({
      cluster,
      name,
      material_id: matId ?? '',
      material_text: matText,
      material_type: get('material_type'),
      spec_thickness_mm: parseNum(get('spec_thickness_mm')),
      spec_width_mm: parseNum(get('spec_width_mm')),
      spec_length_mm: parseNum(get('spec_length_mm')),
      qty_per_unit: parseNum(get('qty_per_unit')),
      dm_kg: parseNum(get('dm_kg')),
      pcs_per_bar: parseNum(get('pcs_per_bar')),
      note: noteBits.filter(Boolean).join(' · '),
    })
  }
  return { rows, unmatched_materials: unmatched }
}
