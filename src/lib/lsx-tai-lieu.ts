/**
 * TÀI LIỆU CỦA LỆNH (04/11/2026, bản vẽ GTwUMER4sxSA8dHyZb8uRN đã duyệt).
 *
 * Logic THUẦN — chọn file nào của hồ sơ SP đi vào gói zip và đặt nó ở đâu.
 * Màn (tab "Tài liệu SP") và route zip cùng gọi một hàm, nên cái màn bày là cái
 * zip chứa — không có chuyện màn nói 8 file BOM mà zip ra 11.
 *
 * Luật chọn (Q1 + Q2 chủ dự án chốt):
 *   · Loại có PHIÊN BẢN (BOM, bản vẽ, đóng gói, HD lắp, xếp cont): MỘT file —
 *     bản đang dùng (`is_current`, 0181); chưa đánh dấu thì bản MỚI NHẤT. 45 file
 *     BOM trên lệnh đang chạy mà chỉ 9 file được đánh dấu (đo 04/11), nên lối lùi
 *     "mới nhất" là đường chính chứ không phải ca hiếm.
 *   · Loại còn lại (ảnh, ảnh mẫu, nhãn, chứng chỉ, khác…): lấy HẾT — hai tấm ảnh
 *     là hai góc chụp, không phải hai phiên bản.
 */

export type TaiLieuFile = {
  id: string
  product_id: string
  doc_type: string | null
  filename: string
  size_bytes: number
  is_current: boolean
  created_at: string
}

export type TaiLieuLine = {
  product_id: string | null
  product_code: string
  name: string
  qty: number
  unit: string
}

/** Loại tài liệu mà nhiều file = nhiều PHIÊN BẢN của cùng một thứ. */
export const VERSIONED_TYPES = [
  'bom',
  'drawing',
  'packing',
  'assembly',
  'loading',
] as const

/** Thư mục con trong zip — ngắn, đọc được trên Explorer. */
const FOLDER: Record<string, string> = {
  bom: 'BOM',
  drawing: 'Ban ve',
  packing: 'Dong goi',
  assembly: 'HD lap rap',
  loading: 'Xep cont',
  image: 'Anh',
  sample_photo: 'Anh mau',
  label: 'Nhan',
  cert: 'Chung chi',
  approval: 'Khach duyet',
  video: 'Video',
}
const folderOf = (t: string | null) => (t && FOLDER[t]) || 'Khac'

export type TaiLieuProduct = {
  product_id: string | null
  product_code: string
  name: string
  qty: number
  unit: string
  /** File BOM sẽ vào zip (null = chưa có). */
  bom: TaiLieuFile | null
  /** Số bản BOM đang có — > 1 thì màn nói rõ đang lấy bản nào. */
  bomVersions: number
  /** BOM có > 1 bản mà KHÔNG bản nào được đánh dấu → đang lấy bản mới nhất. */
  bomGuessed: boolean
  hasDrawing: boolean
  images: number
  /** Mọi file sẽ vào zip của SP này, đã áp luật chọn. */
  picked: TaiLieuFile[]
  /** Nhãn các loại khác ngoài BOM / ảnh ("HD lắp ráp", "Nhãn"...). */
  others: string[]
}

/** Dòng của tab: thêm số dòng định mức đã nạp ở hồ sơ SP (service đếm). */
export type TaiLieuRow = TaiLieuProduct & { parts: number }

const newestFirst = (a: TaiLieuFile, b: TaiLieuFile) =>
  b.created_at.localeCompare(a.created_at)

/** Áp luật chọn cho file của MỘT sản phẩm. */
export function pickFiles(files: TaiLieuFile[]): TaiLieuFile[] {
  const byType = new Map<string, TaiLieuFile[]>()
  for (const f of files) {
    const k = f.doc_type ?? 'other'
    const arr = byType.get(k) ?? []
    arr.push(f)
    byType.set(k, arr)
  }
  const out: TaiLieuFile[] = []
  for (const [t, arr] of byType) {
    const sorted = [...arr].sort(newestFirst)
    if ((VERSIONED_TYPES as readonly string[]).includes(t)) {
      out.push(sorted.find((f) => f.is_current) ?? sorted[0])
    } else out.push(...sorted)
  }
  return out
}

/**
 * Gom theo SP của lệnh. Một mã SP xuất hiện ở hai nhóm PO của lệnh thì vẫn MỘT
 * thư mục, SL cộng lại — zip là tài liệu của mã, không phải của dòng.
 */
export function buildTaiLieu(
  lines: TaiLieuLine[],
  files: TaiLieuFile[],
  labelOf: (docType: string) => string,
): TaiLieuProduct[] {
  const byProduct = new Map<string, TaiLieuFile[]>()
  for (const f of files) {
    const arr = byProduct.get(f.product_id) ?? []
    arr.push(f)
    byProduct.set(f.product_id, arr)
  }
  const out = new Map<string, TaiLieuProduct>()
  for (const l of lines) {
    const key = l.product_id ?? `code:${l.product_code}`
    const seen = out.get(key)
    if (seen) {
      seen.qty += l.qty
      continue
    }
    const mine = l.product_id ? (byProduct.get(l.product_id) ?? []) : []
    const picked = pickFiles(mine)
    const boms = mine.filter((f) => f.doc_type === 'bom')
    const others = [
      ...new Set(
        picked
          .map((f) => f.doc_type ?? 'other')
          .filter((t) => t !== 'bom' && t !== 'image'),
      ),
    ].map(labelOf)
    out.set(key, {
      product_id: l.product_id,
      product_code: l.product_code,
      name: l.name,
      qty: l.qty,
      unit: l.unit,
      bom: picked.find((f) => f.doc_type === 'bom') ?? null,
      bomVersions: boms.length,
      bomGuessed: boms.length > 1 && !boms.some((f) => f.is_current),
      hasDrawing: mine.some((f) => f.doc_type === 'drawing'),
      images: picked.filter((f) => f.doc_type === 'image').length,
      picked,
      others,
    })
  }
  return [...out.values()]
}

/** Bỏ ký tự Windows cấm trong tên file/thư mục, gọn khoảng trắng, cắt dài. */
export function safeName(s: string, max = 80): string {
  const v = s
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
  return (v.slice(0, max).trim() || '_').replace(/[. ]+$/, '') || '_'
}

/**
 * Đường dẫn trong zip cho từng file đã chọn: `<mã> <tên>/<loại>/<tên file>`.
 * Hai file trùng tên trong cùng thư mục thì thêm ` (2)` trước đuôi.
 */
export function zipEntries(
  products: TaiLieuProduct[],
): { fileId: string; path: string }[] {
  const used = new Set<string>()
  const out: { fileId: string; path: string }[] = []
  for (const p of products) {
    const dir = safeName(`${p.product_code} ${p.name}`)
    for (const f of p.picked) {
      const base = `${dir}/${folderOf(f.doc_type)}/`
      const name = safeName(f.filename, 120)
      const dot = name.lastIndexOf('.')
      const stem = dot > 0 ? name.slice(0, dot) : name
      const ext = dot > 0 ? name.slice(dot) : ''
      let path = base + name
      for (let i = 2; used.has(path.toLowerCase()); i++)
        path = `${base}${stem} (${i})${ext}`
      used.add(path.toLowerCase())
      out.push({ fileId: f.id, path })
    }
  }
  return out
}

/** Nội dung "Đọc trước.txt" — SP nào thiếu gì, để người nhận zip khỏi đi dò. */
export function readmeText(
  lsxCode: string,
  products: TaiLieuProduct[],
  failed: string[],
  today: string,
): string {
  const thieuBom = products.filter((p) => !p.bom)
  const doan = products.filter((p) => p.bomGuessed)
  const L: string[] = [
    `Tài liệu của lệnh ${lsxCode} — tải từ HG-ERP ngày ${today}`,
    `${products.length} sản phẩm · ${products.filter((p) => p.bom).length} có file BOM · ${products.filter((p) => p.hasDrawing).length} có bản vẽ`,
    '',
    'Luật lấy file: BOM / bản vẽ / đóng gói / HD lắp ráp lấy MỘT bản — bản đang dùng,',
    'chưa đánh dấu thì bản mới nhất. Ảnh và tài liệu khác lấy hết.',
  ]
  if (thieuBom.length) {
    L.push('', `CHƯA CÓ FILE BOM (${thieuBom.length}) — Kỹ thuật chưa nạp vào hồ sơ SP:`)
    for (const p of thieuBom) L.push(`  - ${p.product_code} ${p.name}`)
  }
  if (doan.length) {
    L.push('', 'CÓ NHIỀU BẢN BOM, CHƯA ĐÁNH DẤU BẢN ĐANG DÙNG — đang lấy bản mới nhất:')
    for (const p of doan)
      L.push(`  - ${p.product_code}: ${p.bom?.filename} (${p.bomVersions} bản)`)
  }
  if (failed.length) {
    L.push('', 'KHÔNG TẢI ĐƯỢC từ kho lưu trữ (mở hồ sơ SP để tải tay):')
    for (const f of failed) L.push(`  - ${f}`)
  }
  return L.join('\r\n') + '\r\n'
}
