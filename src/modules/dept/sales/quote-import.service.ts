import ExcelJS from 'exceljs'
import { parseQuoteExcel, type QuoteExcelRow } from '@/lib/quote-excel'
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

/** Kết quả khớp một dòng file với thư viện sản phẩm. */
export type ImportPreviewRow = QuoteExcelRow & {
  /** 'existing' = đã có trong thư viện · 'new' = sẽ tạo mới · 'blocked' = thiếu dữ liệu. */
  action: 'existing' | 'new' | 'blocked'
  matched_product_id: string | null
  matched_label: string | null
  /** Khớp được nhiều SP → người dùng phải tự chọn, không đoán bừa. */
  ambiguous: boolean
  has_image: boolean
}

export type ImportPreview = {
  source_file_id: string
  sheet_name: string
  header_row: number | null
  rows: ImportPreviewRow[]
  skipped: { row: number; text: string; reason: string }[]
  summary: { total: number; existing: number; new_products: number; blocked: number }
}

const keyOf = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

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

    // Khớp với thư viện: mã nội bộ → mã khách → tên. Nạp một lần, khớp trong bộ nhớ.
    const { rows: products } = await productsRepo.list({
      page: 1,
      page_size: 5000,
      active_only: true,
    })
    const byCode = new Map<string, typeof products>()
    const byItem = new Map<string, typeof products>()
    const byName = new Map<string, typeof products>()
    const push = (
      m: Map<string, typeof products>,
      k: string,
      p: (typeof products)[0],
    ) => {
      if (!k) return
      const arr = m.get(k) ?? []
      arr.push(p)
      m.set(k, arr)
    }
    for (const p of products) {
      push(byCode, keyOf(p.code), p)
      if (p.customer_item_code) push(byItem, keyOf(p.customer_item_code), p)
      push(byName, keyOf(p.name), p)
    }

    const rows: ImportPreviewRow[] = parsed.rows.map((r) => {
      const hits =
        (r.code ? byCode.get(keyOf(r.code)) : undefined) ??
        (r.customer_item_code ? byItem.get(keyOf(r.customer_item_code)) : undefined) ??
        (r.name ? byName.get(keyOf(r.name)) : undefined) ??
        []
      const one = hits.length === 1 ? hits[0] : null
      const blocked = r.missing.length > 0
      return {
        ...r,
        action: blocked ? 'blocked' : one ? 'existing' : 'new',
        matched_product_id: one?.id ?? null,
        matched_label: one ? `${one.code} — ${one.name}` : null,
        ambiguous: hits.length > 1,
        has_image: r.image_id != null,
      }
    })

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
    for (const r of input.rows) {
      let productId = r.product_id
      if (!productId) {
        const product = await productsRepo.insert({
          code: r.code?.trim() || (await nextProductCode()),
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

/** Mã SP tạm cho hàng mới chưa có mã HG — Kỹ thuật đặt lại mã chuẩn sau. */
async function nextProductCode(): Promise<string> {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '')
  return `TMP-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}
