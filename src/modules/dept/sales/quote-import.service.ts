import ExcelJS from 'exceljs'
import { parseQuoteExcel } from '@/lib/quote-excel'
import { resolveImportRows, type ResolvedRow } from '@/lib/quote-import-match'
import { productsRepo } from '@/modules/dept/technical/technical.repo'
import { filesService } from '@/modules/core/files/files.service'
import { quotesService } from './quotes.service'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, NotFound } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'

/**
 * NHẬP BÁO GIÁ TỪ FILE EXCEL — sản phẩm mới kèm ảnh và thông số.
 *
 * Hai nhịp, cố ý tách:
 *   1. `preview` — đọc file, khớp sản phẩm, trả về để người dùng SOI. Chỉ ghi
 *      đúng một thứ: chính file Excel nguồn (để nhịp 2 đọc lại và để lưu vết).
 *      KHÔNG tạo sản phẩm, không tạo báo giá.
 *   2. `commit`  — người dùng duyệt xong mới ghi: tạo SP mới (kèm ảnh bóc từ
 *      file) rồi dựng báo giá.
 *
 * Vì sao nhịp 2 đọc LẠI file thay vì nhận ảnh từ trình duyệt gửi lên: ảnh sản
 * phẩm vài trăm KB mỗi cái, một tờ báo giá vài chục mặt hàng là chục MB chạy
 * vòng client → server vô ích. Đọc lại từ Storage vừa nhẹ vừa chắc.
 *
 * Giữ nguyên nguyên tắc của form hiện có: SP mới chỉ vào thư viện Kỹ thuật KHI
 * người dùng bấm lưu, không tạo SP mồ côi.
 */

/** Ảnh nhúng đã bóc: khoá theo SỐ DÒNG trong sheet. */
type ImageByRow = Map<number, { buffer: Buffer; extension: string }>

const MIME_BY_EXT: Record<string, 'image/png' | 'image/jpeg' | 'image/gif'> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
}

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' as const

/** Ô Excel có thể là công thức / rich text — rút về giá trị hiển thị. */
function cellValue(v: ExcelJS.CellValue): unknown {
  if (v == null) return null
  if (typeof v === 'object') {
    if (v instanceof Date) return v
    const o = v as unknown as Record<string, unknown>
    if ('result' in o) return o.result
    if ('richText' in o)
      return (o.richText as { text: string }[]).map((t) => t.text).join('')
    if ('text' in o) return o.text
    return null
  }
  return v
}

/**
 * Đọc workbook thành lưới ô + ảnh theo dòng.
 *
 * Ảnh neo theo Ô: `range.tl.nativeRow` là chỉ số 0-based của ô góc trên-trái, nên
 * dòng thật = nativeRow + 1. Ảnh thả tự do đè lên nhiều dòng thì tính theo dòng
 * góc trên — đúng thói quen chèn ảnh vào ô của người dùng.
 */
function readSheet(ws: ExcelJS.Worksheet, wb: ExcelJS.Workbook) {
  const grid: unknown[][] = []
  for (let r = 1; r <= ws.rowCount; r++) {
    const row: unknown[] = []
    ws.getRow(r).eachCell({ includeEmpty: true }, (cell, col) => {
      row[col - 1] = cellValue(cell.value)
    })
    grid.push(row)
  }

  const images: ImageByRow = new Map()
  for (const img of ws.getImages()) {
    const rowNo = Math.round(img.range.tl.nativeRow) + 1
    if (images.has(rowNo)) continue // một dòng một ảnh — ảnh sau bỏ qua
    const media = wb.model.media?.find(
      (m) => String((m as { index?: number }).index) === String(img.imageId),
    ) as { buffer?: Buffer; extension?: string } | undefined
    if (media?.buffer) {
      images.set(rowNo, {
        buffer: Buffer.from(media.buffer),
        extension: (media.extension ?? 'png').toLowerCase(),
      })
    }
  }
  return { grid, images }
}

/** Dòng xem trước = dòng đã khớp (kiểu do `@/lib/quote-import-match` định nghĩa). */
export type ImportPreviewRow = ResolvedRow

export type ImportPreview = {
  source_file_id: string
  sheet_name: string
  header_row: number | null
  rows: ImportPreviewRow[]
  skipped: { row: number; text: string; reason: string }[]
  summary: { total: number; existing: number; new_products: number; blocked: number }
}

export const quoteImportService = {
  /**
   * Nhịp 1 — đọc file, khớp SP, KHÔNG ghi gì ngoài file nguồn.
   * Sheet đọc = sheet ĐẦU TIÊN có dòng tiêu đề nhận ra được.
   */
  async preview(user: User, file: Buffer, filename: string): Promise<ImportPreview> {
    await assertAction(user, 'sales.quote.manage')

    const wb = new ExcelJS.Workbook()
    try {
      await wb.xlsx.load(file as unknown as ArrayBuffer)
    } catch {
      throw BadRequest('Không đọc được file — cần đúng định dạng .xlsx')
    }

    let picked: { ws: ExcelJS.Worksheet; grid: unknown[][]; images: ImageByRow } | null =
      null
    let parsed: ReturnType<typeof parseQuoteExcel> | null = null
    for (const ws of wb.worksheets) {
      const { grid, images } = readSheet(ws, wb)
      const res = parseQuoteExcel(grid, new Map())
      if (res.headerRow != null) {
        picked = { ws, grid, images }
        parsed = parseQuoteExcel(
          grid,
          new Map([...images.keys()].map((r) => [r, `r${r}`])),
        )
        break
      }
    }
    if (!picked || !parsed) {
      throw BadRequest(
        'Không tìm thấy dòng tiêu đề — hãy dùng mẫu "BÁO GIÁ — SẢN PHẨM MỚI" (docs/mau)',
      )
    }

    /*
     * Khớp với thư viện. Nạp CẢ SP ngừng dùng: mã là UNIQUE nên SP ngừng dùng
     * vẫn chiếm chỗ — bỏ qua chúng thì dòng ghi mã đó sẽ đi tạo mới và vỡ ở DB.
     * Luật khớp + chặn trùng nằm ở `@/lib/quote-import-match` (thuần, có test).
     */
    const { rows: products } = await productsRepo.list({
      page: 1,
      page_size: 5000,
      active_only: false,
    })
    const rows = resolveImportRows(
      parsed.rows,
      products.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        customer_item_code: p.customer_item_code,
        is_active: p.is_active,
      })),
    )

    // Chỉ ghi MỘT thứ ở nhịp này: file nguồn (nhịp 2 đọc lại để bóc ảnh).
    const source_file_id = await filesService.uploadFromServer(user, {
      buffer: file,
      filename,
      mime_type: XLSX_MIME,
      bucket: 'attachments',
      parent: { kind: 'none' },
    })

    return {
      source_file_id,
      sheet_name: picked.ws.name,
      header_row: parsed.headerRow,
      rows,
      skipped: parsed.skipped,
      summary: {
        total: rows.length,
        existing: rows.filter((r) => r.action === 'existing').length,
        new_products: rows.filter((r) => r.action === 'new').length,
        blocked: rows.filter((r) => r.action === 'blocked').length,
      },
    }
  },

  /**
   * Nhịp 2 — ghi thật: tạo SP mới (kèm ảnh) rồi dựng báo giá.
   * Dòng `blocked` bị bỏ; client chỉ gửi lên những dòng người dùng giữ lại.
   */
  async commit(
    user: User,
    input: {
      source_file_id: string
      customer_id: string
      currency: string
      rows: {
        row: number
        product_id: string | null
        code: string | null
        name: string
        description_en: string | null
        customer_item_code: string | null
        unit: string | null
        unit_price: number
        length_mm: number | null
        width_mm: number | null
        height_mm: number | null
        material: string | null
        qty_per_carton: number | null
        carton_l_cm: number | null
        carton_w_cm: number | null
        carton_h_cm: number | null
        nw_kg: number | null
        gw_kg: number | null
        loading_40hc: number | null
        note: string | null
      }[]
    },
  ): Promise<{ quote_id: string; created_products: number }> {
    await assertAction(user, 'sales.quote.manage')
    if (input.rows.length === 0) throw BadRequest('Không có dòng nào để lưu')

    // Đọc lại file nguồn để bóc ảnh — chỉ khi có dòng SP mới cần ảnh.
    const needImages = input.rows.some((r) => !r.product_id)
    let images: ImageByRow = new Map()
    if (needImages) {
      const target = await filesService.getDownloadTarget(user, input.source_file_id)
      if (!target) throw NotFound('Không tìm thấy file nguồn — hãy tải lên lại')
      const res = await fetch(target.url)
      const buf = Buffer.from(await res.arrayBuffer())
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buf as unknown as ArrayBuffer)
      for (const ws of wb.worksheets) {
        const r = readSheet(ws, wb)
        if (parseQuoteExcel(r.grid, new Map()).headerRow != null) {
          images = r.images
          break
        }
      }
    }

    let created = 0
    const lines: { product_id: string; unit_price: number; note?: string | null }[] = []
    /** Mã đã cấp trong CHÍNH lượt này — chống đụng nhau trước khi kịp ghi DB. */
    const codesInBatch = new Set<string>()
    /** Chặn hai dòng cùng trỏ về một SP: báo giá không có ràng buộc chống trùng. */
    const seenProducts = new Set<string>()

    for (const r of input.rows) {
      let productId = r.product_id

      /*
       * Danh mục có thể ĐỔI giữa lúc xem trước và lúc lưu (người khác vừa tạo SP
       * cùng mã). Kiểm lại ngay trước khi chèn: có rồi thì DÙNG LẠI, không thì
       * `code` UNIQUE sẽ ném lỗi DB thô và bỏ dở giữa chừng.
       */
      if (!productId && r.code?.trim()) {
        productId = await productsRepo.findIdByCode(r.code.trim())
      }

      if (!productId) {
        const product = await productsRepo.insert({
          // Hồ sơ SP sinh ra từ file báo giá vẫn phải biết ai bấm nhập (0179).
          // Không đặt `owner_id`: đây là đường của Kinh doanh, "Người phụ trách
          // hồ sơ" là vai Kỹ thuật — xem `quickCreate`.
          created_by: user.id,
          code: r.code?.trim() || (await nextProductCode(codesInBatch)),
          name: r.name,
          unit: r.unit?.trim() || 'cai',
          customer_item_code: r.customer_item_code,
          description_en: r.description_en,
          material: r.material,
          length_mm: r.length_mm,
          width_mm: r.width_mm,
          height_mm: r.height_mm,
          packing: {
            qty_per_carton: r.qty_per_carton ?? undefined,
            carton_l_cm: r.carton_l_cm ?? undefined,
            carton_w_cm: r.carton_w_cm ?? undefined,
            carton_h_cm: r.carton_h_cm ?? undefined,
            nw_kg: r.nw_kg ?? undefined,
            gw_kg: r.gw_kg ?? undefined,
            loading_40hc: r.loading_40hc ?? undefined,
          },
        })
        productId = product.id
        created++

        const img = images.get(r.row)
        if (img) {
          const mime = MIME_BY_EXT[img.extension] ?? 'image/png'
          const fileId = await filesService.uploadFromServer(user, {
            buffer: img.buffer,
            filename: `${product.code}.${img.extension}`,
            mime_type: mime,
            bucket: 'attachments',
            parent: { kind: 'product', id: product.id },
          })
          await productsRepo.patch(product.id, { image_file_id: fileId })
        }
      }
      if (seenProducts.has(productId)) {
        throw BadRequest(
          `Dòng ${r.row} trỏ về sản phẩm đã có ở dòng trước — báo giá không nhận hai dòng cùng một sản phẩm`,
        )
      }
      seenProducts.add(productId)
      lines.push({ product_id: productId, unit_price: r.unit_price, note: r.note })
    }

    const quote = await quotesService.create(user, {
      customer_id: input.customer_id,
      currency: input.currency,
      lines,
    })
    return { quote_id: quote.id, created_products: created }
  },
}

/**
 * Mã SP tạm cho hàng mới chưa có mã HG — Kỹ thuật đặt lại mã chuẩn sau.
 *
 * PHẢI kiểm tồn tại chứ không phó mặc cho ngẫu nhiên: `technical_products.code`
 * là UNIQUE, mà 4 ký tự random chỉ có ~1,7 triệu tổ hợp — đụng nhau là chèn vỡ
 * giữa chừng, để lại báo giá dở dang. Thử tối đa 20 lần rồi mới chịu thua bằng
 * một lỗi nói rõ, thay vì ném lỗi DB thô lên mặt người dùng.
 */
async function nextProductCode(usedInBatch: Set<string>): Promise<string> {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '')
  for (let i = 0; i < 20; i++) {
    const code = `TMP-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    if (usedInBatch.has(code)) continue
    if (await productsRepo.existsByCode(code)) continue
    usedInBatch.add(code)
    return code
  }
  throw BadRequest('Không sinh được mã sản phẩm tạm — thử lại lần nữa')
}
