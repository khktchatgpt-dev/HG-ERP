import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Conflict, NotFound } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'
import { buildGridText } from '@/lib/bom-grid'
import { readWorkbookGrid, readWorkbookImages } from './bom-workbook'
import { filesRepo } from '@/modules/core/files/files.repo'
import { filesService } from '@/modules/core/files/files.service'
import { partGroupsRepo, productProfileRepo, productsRepo } from './technical.repo'
import { productsService } from './technical.service'
import { productPartsBulkSchema } from './technical.schema'
import {
  BOM_AI_MAX_BYTES,
  BOM_AI_MIMES,
  bomDraftSchema,
  bomDraftWithProductSchema,
  type BomAiApplyInput,
  type BomAiCreateInput,
  type BomAiExtractInput,
  type BomAiNewExtractInput,
  type BomDraftLine,
  type BomDraftProduct,
  type BomDraftSection,
} from './bom-ai.schema'
import { resolveExtractor } from './bom-ai.provider'

/**
 * ĐỌC FILE BOM BẰNG AI → BẢN NHÁP định mức cho hồ sơ sản phẩm.
 *
 * Dịch vụ này KHÔNG GHI GÌ VÀO ĐỊNH MỨC. Nó trả về bản nháp để người dùng soi
 * trên lưới rồi tự bấm lưu qua `POST .../parts/bulk` sẵn có. Cố ý không mở
 * đường ghi thứ hai: mọi dòng định mức vẫn phải qua `productPartsBulkSchema` và
 * `calcPartDerived` như dòng gõ tay, và người chịu trách nhiệm về con số vẫn là
 * người bấm lưu chứ không phải mô hình.
 *
 * Hai đường vào file, khác nhau ở chỗ lấy byte:
 *   · `.xlsx` → đọc thành LƯỚI Ô rồi gửi text. Rẻ hơn nhiều lần so với ảnh,
 *     chính xác hơn, và chỉ đường này mới có địa chỉ ô cho `source_ref`.
 *   · PDF / ảnh → gửi thẳng cho mô hình đọc.
 *
 * File `.xls` đời cũ (BIFF8) KHÔNG đọc được bằng exceljs — báo rõ để người dùng
 * lưu lại thành .xlsx, thay vì đọc ra lưới rỗng rồi bảo "không thấy dòng nào".
 */

export type BomAiDraft = {
  sections: BomDraftSection[]
  meta: {
    provider: string
    model: string
    /** Đọc qua lưới ô (.xlsx) hay qua tài liệu (PDF/ảnh). */
    mode: 'grid' | 'document'
    filename: string
    sheets: { name: string; emitted: number }[]
    /** Phần KHÔNG đưa vào cho mô hình đọc — luôn bày ra, không nuốt im lặng. */
    truncated: string[]
    /** Dòng mô hình trả về nhưng không có TÊN — thứ duy nhất khiến dòng vô nghĩa. */
    dropped: number
    lines: number
    /**
     * Dòng đọc được nhưng file BỎ TRỐNG cột Số lượng. Giữ nguyên trong bản nháp
     * để không mất quy cách; người dùng phải điền trước khi lưu vì DB có ràng
     * buộc `qty not null check (qty > 0)`.
     */
    missingQty: number
    /**
     * Định mức ĐANG CÓ trong hồ sơ, đếm theo nhóm. Để màn duyệt cảnh báo trước
     * khi ghi — nhiều hồ sơ đã được script nạp sẵn từ chính file BOM đó, đọc
     * lại rồi bấm Lưu ở chế độ thêm là nhân đôi.
     */
    existing: { total: number; byGroup: Record<string, number> }
  }
}

/** Bản nháp khi TẠO SP MỚI — thêm khối thuộc tính, bỏ phần đếm định mức cũ. */
export type BomAiNewDraft = {
  product: BomDraftProduct
  sections: BomDraftSection[]
  meta: Omit<BomAiDraft['meta'], 'existing'> & {
    /** Dung lượng ảnh SP nhúng trong file, null nếu file không có ảnh. */
    embeddedImageBytes: number | null
    /**
     * Hồ sơ ĐANG GIỮ mã ghi trong file, null nếu mã còn trống chỗ. Có giá trị =
     * sản phẩm này đã nằm trong thư viện, đừng tạo bản thứ hai.
     */
    existingProduct: { id: string; code: string; name: string } | null
  }
}

const XLSX_MIMES = new Set<string>([
  BOM_AI_MIMES.xlsx,
  'application/vnd.ms-excel.sheet.macroEnabled.12',
])

/**
 * `.xls` đời cũ (BIFF8) exceljs không mở được — đổi lỗi kỹ thuật thành câu chỉ
 * việc phải làm, thay vì để người dùng nhìn stack trace.
 */
async function readGrid(buffer: Buffer) {
  try {
    return await readWorkbookGrid(buffer)
  } catch {
    throw BadRequest(
      'Không đọc được file Excel. File .xls đời cũ cần mở bằng Excel rồi "Lưu thành" .xlsx',
    )
  }
}

/** Byte + mime + tên của file nguồn, dù đến từ hồ sơ hay từ máy người dùng. */
async function loadSource(
  user: User,
  productId: string,
  source: BomAiExtractInput['source'],
): Promise<{ buffer: Buffer; mime: string; filename: string }> {
  if (source.kind === 'upload') {
    const buffer = Buffer.from(source.data_base64, 'base64')
    if (buffer.length === 0) throw BadRequest('File rỗng')
    if (buffer.length > BOM_AI_MAX_BYTES) {
      throw BadRequest(
        `File ${(buffer.length / 1024 / 1024).toFixed(1)} MB — vượt trần ${BOM_AI_MAX_BYTES / 1024 / 1024} MB`,
      )
    }
    return { buffer, mime: source.mime, filename: source.filename }
  }

  const file = await filesRepo.getById(source.file_id)
  if (!file || file.deleted_at) throw NotFound('File không tồn tại')
  // File đính ở hồ sơ KHÁC thì không cho đọc sang — tránh mượn màn hình SP này
  // để moi tài liệu của SP kia.
  if (file.product_id !== productId) {
    throw BadRequest('File không thuộc hồ sơ sản phẩm này')
  }
  if (file.size_bytes > BOM_AI_MAX_BYTES) {
    throw BadRequest(
      `File ${(file.size_bytes / 1024 / 1024).toFixed(1)} MB — vượt trần ${BOM_AI_MAX_BYTES / 1024 / 1024} MB`,
    )
  }

  // Qua `filesService` để dùng đúng lớp kiểm quyền đọc file sẵn có.
  const { url } = await filesService.getDownloadTarget(user, file.id)
  const res = await fetch(url)
  if (!res.ok) throw BadRequest('Không tải được file từ kho lưu trữ')
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    mime: file.mime_type,
    filename: file.filename,
  }
}

/**
 * Dòng mô hình trả về phải qua `bomDraftLineSchema` mới được nhận. Dòng hỏng
 * (thiếu tên, SL ≤ 0) bị loại và ĐẾM LẠI — con số đó hiện lên UI, vì "đọc được
 * 40 dòng" khi file có 45 dòng là thông tin người kiểm cần biết.
 */
function validateDraft(
  raw: unknown,
  allowedGroups: Set<string>,
): { sections: BomDraftSection[]; dropped: number; missingQty: number } {
  const parsed = bomDraftSchema.safeParse(raw)
  if (!parsed.success) {
    // Cả gói hỏng hình dạng là lỗi hệ thống chứ không phải lỗi người dùng —
    // structured outputs đáng ra đã chặn.
    throw BadRequest('Mô hình trả về dữ liệu không đúng cấu trúc, thử lại')
  }

  let dropped = 0
  let missingQty = 0
  const sections: BomDraftSection[] = []
  for (const section of parsed.data.sections) {
    if (!allowedGroups.has(section.group_code)) {
      dropped += section.lines.length
      continue
    }
    const lines: BomDraftLine[] = []
    for (const line of section.lines) {
      // Chỉ TÊN mới là điều kiện sống của một dòng. Dòng thiếu SỐ LƯỢNG vẫn
      // GIỮ LẠI (đếm riêng): file BOM bỏ trống cột SL là chuyện thường, loại đi
      // là mất luôn quy cách đã đọc được và người dùng phải gõ lại từ đầu.
      if (!line.part_name) {
        dropped++
        continue
      }
      if (line.qty == null) missingQty++
      lines.push(line)
    }
    if (lines.length > 0) sections.push({ ...section, lines })
  }
  return { sections, dropped, missingQty }
}

/**
 * Ép một khối bản nháp qua ĐÚNG schema của lưới gõ tay trước khi ghi.
 *
 * `bomAiApplySchema` nhận dòng dạng record tự do (client gửi cả trường duyệt
 * `confidence` / `source_ref`) — zod của `productPartsBulkSchema` vừa kiểm ràng
 * buộc vừa LỘT các trường lạ đó ra. Thiếu bước này là chúng trôi thẳng vào
 * insert và Postgres ném "Could not find the 'confidence' column".
 */
function parseBulkSection(s: {
  group_code: string
  section_title?: string | null
  unit_basis?: string | null
  lines: Record<string, unknown>[]
}) {
  /*
   * BỎ chốt chặn "thiếu số lượng" (0163). DB nay cho `qty` null nên dòng thiếu
   * SL ghi được, và giữ lại một dòng đọc đúng nhưng khuyết một ô vẫn hơn là vứt.
   *
   * Ô rỗng dạng CHUỖI vẫn phải nắn về null — client gửi `""` khi người dùng xoá
   * ô, mà `z.coerce.number()` biến `""` thành 0 rồi vướng `check (qty > 0)` của
   * DB, ném ra một lỗi Postgres không ai đọc hiểu.
   */
  const lines = s.lines.map((l) => (l.qty === '' ? { ...l, qty: null } : l))
  return productPartsBulkSchema.parse({
    group_code: s.group_code,
    section_title: s.section_title ?? null,
    unit_basis: s.unit_basis ?? null,
    lines,
  })
}

/** Nhóm hạng mục hợp lệ, đọc lúc chạy vì đây là DỮ LIỆU trong DB (0093). */
async function loadGroups(): Promise<{ code: string; label: string }[]> {
  const groups = (await partGroupsRepo.list()).map((g) => ({
    code: g.code,
    label: g.label,
  }))
  if (groups.length === 0) throw BadRequest('Chưa khai nhóm hạng mục nào')
  return groups
}

/**
 * Byte → bản nháp thô. Phần dùng chung của hai lối vào (đọc cho hồ sơ có sẵn /
 * tạo SP mới): chọn đường lưới-ô hay đường tài liệu rồi gọi mô hình.
 */
async function runExtract(
  buffer: Buffer,
  mime: string,
  filename: string,
  groups: { code: string; label: string }[],
  opts: { productHint?: string; withProduct?: boolean; filename?: string } = {},
) {
  const { extract, provider } = await resolveExtractor()
  const isSheet = XLSX_MIMES.has(mime) || /\.xlsx$/i.test(filename)

  if (isSheet) {
    const grid = buildGridText(await readGrid(buffer))
    if (!grid.text.trim()) throw BadRequest('File Excel không có ô nào có dữ liệu')
    const result = await extract({ grid: grid.text, groups, ...opts })
    return {
      result,
      provider,
      mode: 'grid' as const,
      sheets: grid.sheets,
      truncated: grid.truncated,
    }
  }

  const result = await extract({
    document: { mimeType: mime, dataBase64: buffer.toString('base64') },
    groups,
    ...opts,
  })
  return {
    result,
    provider,
    mode: 'document' as const,
    sheets: [] as { name: string; emitted: number }[],
    truncated: [] as string[],
  }
}

export const bomAiService = {
  /**
   * Đọc file BOM và trả BẢN NHÁP. Quyền dùng `technical.bom.save` (chứ không
   * phải quyền xem): kết quả chỉ có nghĩa với người sắp ghi định mức, và mỗi
   * lần gọi là một lần tốn tiền API.
   */
  async extract(
    user: User,
    productId: string,
    input: BomAiExtractInput,
  ): Promise<BomAiDraft> {
    await assertAction(user, 'technical.bom.save')

    const product = await productsRepo.findById(productId)
    if (!product) throw NotFound('Sản phẩm không tồn tại')
    // Chặn sớm: hồ sơ khoá thì bản nháp không lưu được, gọi mô hình chỉ tốn tiền.
    if (product.locked_at) {
      throw Conflict(
        `Hồ sơ ${product.code ?? ''} đã KHOÁ — mở khoá rồi mới nhập định mức được`.trim(),
        'PRODUCT_LOCKED',
      )
    }

    const groups = await loadGroups()
    const { buffer, mime, filename } = await loadSource(user, productId, input.source)
    const { result, provider, mode, sheets, truncated } = await runExtract(
      buffer,
      mime,
      filename,
      groups,
      { productHint: [product.code, product.name].filter(Boolean).join(' — ') },
    )

    const { sections, dropped, missingQty } = validateDraft(
      result.raw,
      new Set(groups.map((g) => g.code)),
    )

    const byGroup = await productProfileRepo.countPartsByGroup(productId)
    return {
      sections,
      meta: {
        provider,
        model: result.model,
        mode,
        filename,
        sheets,
        truncated,
        dropped,
        lines: sections.reduce((n, s) => n + s.lines.length, 0),
        missingQty,
        existing: {
          total: Object.values(byGroup).reduce((a, b) => a + b, 0),
          byGroup,
        },
      },
    }
  },

  /**
   * Đọc file BOM để TẠO SP MỚI — chưa có hồ sơ nào, nên đọc thêm khối thuộc
   * tính ở đầu file (tên, mã, KTSP, đóng gói) chứ không chỉ định mức.
   *
   * Quyền là `technical.product.create`, không phải `technical.bom.save`: việc
   * này đẻ ra hồ sơ mới trong thư viện chứ không sửa định mức của ai.
   *
   * Nguồn chỉ nhận file TẢI LÊN: chưa có sản phẩm thì cũng chưa có file nào
   * đính vào nó để mà chọn.
   */
  async extractForNewProduct(
    user: User,
    input: BomAiNewExtractInput,
  ): Promise<BomAiNewDraft> {
    await assertAction(user, 'technical.product.create')

    const buffer = Buffer.from(input.data_base64, 'base64')
    if (buffer.length === 0) throw BadRequest('File rỗng')
    if (buffer.length > BOM_AI_MAX_BYTES) {
      throw BadRequest(
        `File ${(buffer.length / 1024 / 1024).toFixed(1)} MB — vượt trần ${BOM_AI_MAX_BYTES / 1024 / 1024} MB`,
      )
    }

    const groups = await loadGroups()
    const { result, provider, mode, sheets, truncated } = await runExtract(
      buffer,
      input.mime,
      input.filename,
      groups,
      { withProduct: true, filename: input.filename },
    )

    const parsed = bomDraftWithProductSchema.safeParse(result.raw)
    if (!parsed.success) {
      throw BadRequest('Mô hình trả về dữ liệu không đúng cấu trúc, thử lại')
    }
    const { sections, dropped, missingQty } = validateDraft(
      result.raw,
      new Set(groups.map((g) => g.code)),
    )

    // Ảnh SP nhúng sẵn trong file (ô "Hình ảnh" của biểu mẫu) — chỉ BÁO có hay
    // không, byte thì lấy lại từ file client gửi kèm lúc bấm Tạo. Lỗi đọc ảnh
    // không được làm hỏng cả lần đọc định mức.
    const embedded = await readWorkbookImages(buffer).catch(() => null)

    /*
     * MÃ TRONG FILE ĐÃ CÓ HỒ SƠ → nói ra, đừng lặng lẽ cấp mã khác.
     *
     * Bản trước xoá mã đi để người dùng xin số mới. Nhưng mã HG trong file có
     * nghĩa "đây LÀ sản phẩm đó" — cấp mã khác là đẻ hồ sơ thứ hai cho cùng một
     * thứ, đúng thứ thư viện đang phải dọn. Nay giữ nguyên mã và trả kèm hồ sơ
     * đang giữ nó; màn duyệt bày ra để người dùng chọn: mở hồ sơ cũ, nạp định
     * mức vào đó, hay thật sự muốn tạo bản mới thì tự xin mã.
     *
     * Mã KHÔNG trùng thì dùng luôn của file — không cần xin mã mới.
     */
    const product = parsed.data.product
    const existingProduct = product.code
      ? await productsRepo.findByCodeLite(product.code)
      : null

    return {
      product,
      sections,
      meta: {
        provider,
        model: result.model,
        mode,
        filename: input.filename,
        sheets,
        truncated,
        dropped,
        lines: sections.reduce((n, s) => n + s.lines.length, 0),
        missingQty,
        embeddedImageBytes: embedded?.buffer.byteLength ?? null,
        existingProduct,
      },
    }
  },

  /**
   * TẠO SP MỚI rồi ghi định mức, trong một lượt gọi.
   *
   * Gộp ở server chứ không để client gọi hai lần: nếu tạo xong SP mà lượt ghi
   * định mức hỏng, người dùng còn lại một hồ sơ rỗng không biết từ đâu ra. Ở đây
   * lỗi ghi định mức được báo kèm mã SP đã tạo, để họ biết đường quay lại.
   */
  async createFromBom(
    user: User,
    input: BomAiCreateInput,
  ): Promise<{
    product_id: string
    code: string
    added: number
    saved_file: boolean
    saved_image: boolean
  }> {
    await assertAction(user, 'technical.product.create')

    /*
     * GIỮ LẠI dòng thiếu SL (0163 — user chốt 19/08/2026).
     *
     * Bản trước LỌC BỎ chúng, nên file nào bỏ trống cột Số lượng là hồ sơ tạo ra
     * rỗng định mức: `BOM_MERXX_Ghế Xếp Chồng Tilos.xlsx` trống cả 11/11 dòng
     * khung, mất sạch tên chi tiết · mã khuôn · ba kích thước mà máy đã đọc đúng
     * — chỉ vì thiếu một ô.
     *
     * Nay ghi hết, ô SL để null; tab Định mức bày "cần SL" bằng màu chặn để
     * người dùng điền nốt. Dòng chưa có SL KHÔNG vào nhu cầu vật tư của Cung ứng
     * — mệnh đề `pp.qty is not null` trong migration 0163 lo phần đó.
     */
    const withQty = input.sections.filter((s) => s.lines.length > 0)

    // Validate HẾT các khối TRƯỚC khi tạo SP: một khối hỏng phát hiện sau khi
    // đã insert là để lại hồ sơ mồ côi không định mức (đã dính một lần —
    // client gửi kèm trường duyệt `confidence`, DB không có cột đó, nổ ở khối
    // đầu tiên sau khi SP đã nằm trong bảng).
    const sections = withQty.map((s) => parseBulkSection(s))

    const product = await productsService.create(user, input.product)

    // `create` chỉ insert bộ cột của form "Thêm sản phẩm" — kích thước bình
    // thường vào sau qua tab Thông số, nên patch bồi một lượt.
    //
    // `owner_id` KHÔNG còn đặt ở đây: từ 0179 `create` tự ghi cả `created_by`
    // lẫn `owner_id` theo phiên đăng nhập cho mọi đường tạo của Kỹ thuật. Hồ sơ
    // đọc từ file vẫn ghi nhận người tạo theo NGƯỜI ĐANG ĐĂNG NHẬP, không chép
    // chữ ký giấy ở khối ISO của file (user chốt 18/08/2026).
    const p = input.product
    await productsService.update(user, product.id, {
      length_mm: p.length_mm ?? null,
      width_mm: p.width_mm ?? null,
      height_mm: p.height_mm ?? null,
    })

    /*
     * GHI ĐỊNH MỨC HỎNG → XOÁ LUÔN HỒ SƠ VỪA TẠO rồi mới ném lỗi.
     *
     * `parseBulkSection` ở trên đã chặn mọi lỗi HÌNH DẠNG trước khi tạo SP,
     * nhưng không chặn được lỗi phát sinh ở tầng DB. Đo thật 19/08/2026: ràng
     * buộc `qty not null` (migration 0163 chưa áp) làm insert nổ SAU khi SP đã
     * nằm trong bảng — người dùng thấy 500, bấm lại thì ăn 409 CODE_TAKEN vì
     * chính hồ sơ mồ côi của lượt trước đang giữ mã.
     *
     * Xoá là an toàn: hồ sơ vừa tạo xong trong cùng một request, chưa ai kịp
     * đính gì vào (file/ảnh làm ở dưới), nên không có dữ liệu của người khác để
     * mất. Lỗi xoá thì nuốt — ném ra sẽ che mất nguyên nhân thật.
     */
    let added = 0
    try {
      for (const s of sections) {
        const r = await productsService.addParts(user, product.id, s)
        added += r.added
      }
    } catch (e) {
      await productsRepo.delete(product.id).catch(() => {})
      throw BadRequest(
        `Ghi định mức thất bại nên đã huỷ hồ sơ ${product.code} — không để lại mã treo. ${
          e instanceof Error ? e.message : ''
        }`.trim(),
      )
    }

    /*
     * Đính file nguồn + ảnh SP — làm SAU CÙNG và nuốt lỗi có chủ ý.
     *
     * Hồ sơ và định mức mới là thứ người dùng cần; hỏng ở khâu lưu file mà ném
     * lỗi ra thì họ tưởng cả lượt Tạo thất bại và bấm lại, đẻ thêm SP trùng.
     * Thà báo "đã tạo, chưa đính được file" qua cờ trả về.
     */
    let savedFile = false
    let savedImage = false
    const src = input.source_file
    if (src) {
      const buffer = Buffer.from(src.data_base64, 'base64')

      if (src.save_file) {
        try {
          await filesService.uploadFromServer(user, {
            buffer,
            filename: src.filename,
            mime_type: src.mime as never,
            bucket: 'attachments',
            parent: { kind: 'product', id: product.id },
            doc_type: 'bom',
          })
          savedFile = true
        } catch {
          /* hồ sơ vẫn đứng — người dùng đính tay ở tab Tài liệu */
        }
      }

      if (src.save_image) {
        try {
          const img = await readWorkbookImages(buffer)
          if (img) {
            const fileId = await filesService.uploadFromServer(user, {
              buffer: img.buffer,
              filename: `${product.code}.${img.extension}`,
              mime_type: img.mime as never,
              bucket: 'attachments',
              parent: { kind: 'product', id: product.id },
              doc_type: 'image',
            })
            await productsService.setMainImage(user, product.id, fileId)
            savedImage = true
          }
        } catch {
          /* không có ảnh hoặc ảnh hỏng — bỏ qua, upload tay sau */
        }
      }
    }

    return {
      product_id: product.id,
      code: product.code,
      added,
      saved_file: savedFile,
      saved_image: savedImage,
    }
  },

  /**
   * GHI bản nháp đã duyệt. Đi qua `productsService.addParts` — cùng cửa với lưới
   * gõ tay, nên vẫn zod-validate và vẫn `calcPartDerived` tính lại số dẫn xuất.
   *
   * `replace` xoá TRƯỚC, một lần, cho toàn bộ các nhóm có mặt trong bản nháp —
   * xoá xen kẽ từng khối sẽ cắn vào khối vừa ghi khi hai khối cùng nhóm.
   */
  async apply(
    user: User,
    productId: string,
    input: BomAiApplyInput,
  ): Promise<{ added: number; removed: number }> {
    await assertAction(user, 'technical.bom.save')

    // Validate trước, XOÁ sau: `replace` mà xoá xong mới phát hiện khối hỏng
    // là mất trắng định mức cũ.
    const sections = input.sections.map((s) => parseBulkSection(s))

    const groups = [...new Set(sections.map((s) => s.group_code))]
    const removed =
      input.mode === 'replace'
        ? await productProfileRepo.deletePartsByGroups(productId, groups)
        : 0

    let added = 0
    for (const s of sections) {
      const r = await productsService.addParts(user, productId, s)
      added += r.added
    }
    return { added, removed }
  },
}
