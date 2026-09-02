import 'server-only'
import { summarizeProduct, BOM_ISSUES, type BomIssue } from '@/lib/bom-health'
import { productHealthRepo, type HealthPartRow } from './technical.repo'

/**
 * SỨC KHOẺ ĐỊNH MỨC — hồ sơ SP nào chưa dùng được để đi mua hàng.
 *
 * Vì sao có màn này: độ phủ BOM đang là nút thắt go-live, nhưng chỗ duy nhất
 * biết "còn thiếu gì" là mấy script chạy tay (`bom-derived-fix.mjs`) — chạy
 * xong in ra console rồi thôi, Kỹ thuật không có chỗ để làm việc theo. Màn này
 * biến báo cáo một-lần đó thành danh sách việc xếp theo mức nợ.
 *
 * Luật chấm điểm nằm ở `@/lib/bom-health` (thuần, có test) — service chỉ lấy
 * dữ liệu và gộp.
 */

export type BomHealthRow = {
  id: string
  code: string
  name: string
  customer_name: string | null
  category: string | null
  bom_status: string
  parts: number
  dirtyParts: number
  score: number
  counts: Record<BomIssue, number>
}

export type BomHealthSummary = {
  products: number
  /** Hồ sơ 0 dòng định mức — rổ nặng nhất, tách riêng khỏi "có lỗi". */
  noBom: number
  /** Hồ sơ CÓ dòng nhưng còn lỗi. */
  dirty: number
  clean: number
  /** Tổng dòng định mức đang lỗi, gộp theo loại. */
  counts: Record<BomIssue, number>
  totalParts: number
}

export type BomHealthReport = {
  rows: BomHealthRow[]
  summary: BomHealthSummary
}

const zero = (): Record<BomIssue, number> =>
  Object.fromEntries(BOM_ISSUES.map((k) => [k, 0])) as Record<BomIssue, number>

/**
 * Chấm toàn bộ hồ sơ SP.
 *
 * Đọc: mọi NV đã đăng nhập. Cố ý không gác riêng cho Kỹ thuật — Cung ứng cần
 * biết SP nào chưa đủ định mức TRƯỚC khi lên đơn, và Giám đốc cần con số phủ
 * BOM. Đây là dữ liệu chẩn đoán, không phải dữ liệu nhạy cảm; màn hình chỉ
 * ĐỌC, mọi đường sửa vẫn đi qua hồ sơ SP với quyền cũ.
 */
export async function buildBomHealth(): Promise<BomHealthReport> {
  // Một lượt quét bảng định mức + một lượt danh sách SP. Gộp trong bộ nhớ chứ
  // không join: ~800 hồ sơ × vài nghìn dòng, rẻ hơn nhiều so với N+1 truy vấn.
  const [parts, products] = await Promise.all([
    productHealthRepo.allParts(),
    productHealthRepo.allProducts(),
  ])

  const byProduct = new Map<string, HealthPartRow[]>()
  for (const p of parts) {
    const bucket = byProduct.get(p.product_id)
    if (bucket) bucket.push(p)
    else byProduct.set(p.product_id, [p])
  }

  const summary: BomHealthSummary = {
    products: 0,
    noBom: 0,
    dirty: 0,
    clean: 0,
    counts: zero(),
    totalParts: parts.length,
  }

  const rows: BomHealthRow[] = products.map((prod) => {
    const health = summarizeProduct(byProduct.get(prod.id) ?? [])

    summary.products++
    if (health.parts === 0) summary.noBom++
    else if (health.dirtyParts > 0) summary.dirty++
    else summary.clean++
    for (const k of BOM_ISSUES) summary.counts[k] += health.counts[k]

    return {
      id: prod.id,
      code: prod.code,
      name: prod.name,
      customer_name: prod.customer_name,
      category: prod.category,
      bom_status: prod.bom_status,
      parts: health.parts,
      dirtyParts: health.dirtyParts,
      score: health.score,
      counts: health.counts,
    }
  })

  // Xếp NỢ NẶNG lên đầu: điểm thấp trước, cùng điểm thì nhiều dòng lỗi trước.
  // Danh sách này là hàng đợi việc, không phải bảng tra cứu — thứ tự chính là
  // câu trả lời cho "làm cái nào trước".
  rows.sort(
    (a, b) =>
      a.score - b.score || b.dirtyParts - a.dirtyParts || a.code.localeCompare(b.code),
  )

  return { rows, summary }
}
