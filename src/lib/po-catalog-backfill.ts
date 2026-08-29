/**
 * DANH MỤC TỰ GIÀU TỪ DÒNG ĐƠN (13/08/2026) — logic thuần cho handler
 * `po.catalog`: người soạn đơn đã gõ quy cách/vật liệu/cách mở… thật vào dòng,
 * mà danh mục vẫn trống mãi và lần sau lại gõ. Hai mức, hai độ an toàn:
 *
 *   · MÔ TẢ (spec, vật liệu, bề mặt, cách mở, pcs/thùng): CHỈ ĐIỀN Ô TRỐNG của
 *     danh mục, không bao giờ đè — sai cũng chỉ là "có thêm thông tin", sửa
 *     được ở danh mục; đè mới là phá số người khác đã khai.
 *   · GIÁ (last_purchase_price): ghi ĐÈ có chủ đích khi đơn GỬI NCC — cột này
 *     nghĩa là "giá mua gần nhất". Chỉ đơn VND: đơn USD ghi 700.21 vào cột giá
 *     ngầm-VND là sai bậc tiền.
 *
 * Barem (kg/m, dài cây, kg/đơn vị) CỐ Ý không đi đường này — số nhân thẳng ra
 * tiền của mọi đơn sau, giữ nút "lưu vào danh mục" bấm tay có chủ đích.
 */

import { parseInnerDims } from './dims'

/**
 * m³/SP + BẢO HÀNH — cần migration `0178_material_m3_warranty.sql`.
 *
 * ĐÃ APPLY trên project `pcbfvrapknzykhtntuwg` lúc 29/08/2026 (qua MCP
 * `apply_migration`, xác nhận bằng truy vấn thật hai cột trả 200).
 *
 * Cờ này GIỮ LẠI làm phanh cho môi trường khác (bản clone/staging chưa chạy
 * 0178): để `false` thì hai trường không được ghi, phần còn lại của hộp xác
 * nhận vẫn chạy. Đi kèm là hằng `COLS` ở `warehouse.repo.ts` — bật cờ mà quên
 * cột thì đọc luôn ra null, tắt cột mà quên cờ thì mọi truy vấn danh mục hỏng.
 */
export const MATERIAL_0178_APPLIED = true

/** Trường mô tả trên dòng đơn có thể chảy về danh mục. */
export type CatalogLineInfo = {
  material_id?: string | null
  spec?: string | null
  material_grade?: string | null
  finish?: string | null
  open_style?: string | null
  pcs_per_ctn?: number | null
  /*
   * BAREM + ĐÓNG GÓI (29/08/2026) — trước cố ý để ngoài đường này với lý do
   * "số nhân thẳng ra tiền, giữ nút bấm tay". Thực tế nút bấm tay chỉ có ở
   * kg/m và kg/đơn vị, nằm bé xíu trên ô, và đóng gói thì KHÔNG có đường nào:
   * người mua gõ "1 bì = 500 con" ở mọi đơn, mãi mãi. Nay tất cả đi CHUNG một
   * hộp xác nhận — vẫn fill-empty-only nên vẫn không đè ai.
   */
  kg_per_m?: number | null
  kg_per_unit?: number | null
  pack_size?: number | null
  pack_unit?: string | null
  /** m³/SP (mẫu gỗ) và Bảo hành (mẫu MRO) — danh mục có cột từ 0178. */
  m3_per_unit?: number | null
  warranty_text?: string | null
}

/** Trường tương ứng của bản ghi danh mục — null/'' coi là TRỐNG. */
export type CatalogFields = {
  spec: string | null
  material_grade: string | null
  finish: string | null
  open_style: string | null
  pcs_per_ctn: number | null
  kg_per_m: number | null
  kg_per_unit: number | null
  pack_size: number | null
  pack_unit: string | null
  m3_per_unit: number | null
  warranty_text: string | null
}

const clean = (v: string | null | undefined, max: number): string | null => {
  const t = (v ?? '').trim()
  return t ? t.slice(0, max) : null
}
const empty = (v: string | number | null | undefined): boolean =>
  v == null || String(v).trim() === ''

/**
 * Bản vá fill-empty-only cho MỘT vật tư từ MỘT dòng đơn. Trả null khi không có
 * gì để điền — handler khỏi gọi PATCH rỗng.
 */
export function catalogFillPatch(
  material: CatalogFields,
  line: CatalogLineInfo,
): Partial<CatalogFields> | null {
  const patch: Partial<CatalogFields> = {}
  const spec = clean(line.spec, 200)
  if (spec && empty(material.spec)) patch.spec = spec
  const grade = clean(line.material_grade, 100)
  if (grade && empty(material.material_grade)) patch.material_grade = grade
  const finish = clean(line.finish, 100)
  if (finish && empty(material.finish)) patch.finish = finish
  const open = clean(line.open_style, 20)
  if (open && empty(material.open_style)) patch.open_style = open
  const pcs = Number(line.pcs_per_ctn)
  if (Number.isFinite(pcs) && pcs > 0 && material.pcs_per_ctn == null) {
    patch.pcs_per_ctn = pcs
  }
  // Barem + đóng gói: cùng luật fill-empty-only với mô tả.
  const kgm = Number(line.kg_per_m)
  if (Number.isFinite(kgm) && kgm > 0 && material.kg_per_m == null) patch.kg_per_m = kgm
  const kgu = Number(line.kg_per_unit)
  if (Number.isFinite(kgu) && kgu > 0 && material.kg_per_unit == null) {
    patch.kg_per_unit = kgu
  }
  const packSize = Number(line.pack_size)
  if (Number.isFinite(packSize) && packSize > 0 && material.pack_size == null) {
    patch.pack_size = packSize
  }
  const packUnit = clean(line.pack_unit, 50)
  if (packUnit && empty(material.pack_unit)) patch.pack_unit = packUnit
  if (MATERIAL_0178_APPLIED) {
    const m3 = Number(line.m3_per_unit)
    if (Number.isFinite(m3) && m3 > 0 && material.m3_per_unit == null) {
      patch.m3_per_unit = m3
    }
    const warranty = clean(line.warranty_text, 100)
    if (warranty && empty(material.warranty_text)) patch.warranty_text = warranty
  }
  return Object.keys(patch).length > 0 ? patch : null
}

/**
 * GIÁ MUA GẦN NHẤT — luật KHÁC HẲN nhóm trên: ĐÈ, không phải điền ô trống.
 * "Giá gần nhất" mà chỉ ghi khi ô đang trống thì đứng yên mãi ở lần mua đầu.
 *
 * Trả null khi không có gì để hỏi: đơn ngoại tệ (cột giá ngầm là VND — ghi
 * 700.21 vào đó là sai bậc tiền), không có giá, hoặc giá y hệt bản đang có.
 */
export function priceChange(
  material: { last_purchase_price: number | null },
  currency: string,
  unitPrice: number | null | undefined,
): { before: number | null; after: number } | null {
  if (currency !== 'VND') return null
  const after = Number(unitPrice)
  if (!Number.isFinite(after) || after <= 0) return null
  const before = material.last_purchase_price ?? null
  if (before != null && Number(before) === after) return null
  return { before, after }
}

/**
 * Gộp dòng theo vật tư (một đơn có thể tách cùng mã thành nhiều dòng) — dòng
 * ĐẦU TIÊN có giá trị thắng, cùng thứ tự người soạn nhìn trên đơn.
 */
export function linesByMaterial(lines: CatalogLineInfo[]): Map<string, CatalogLineInfo> {
  const out = new Map<string, CatalogLineInfo>()
  for (const l of lines) {
    if (!l.material_id) continue
    const cur = out.get(l.material_id)
    if (!cur) {
      out.set(l.material_id, l)
      continue
    }
    // Dòng sau chỉ lấp trường dòng trước còn trống.
    out.set(l.material_id, {
      ...l,
      spec: cur.spec?.trim() ? cur.spec : l.spec,
      material_grade: cur.material_grade?.trim() ? cur.material_grade : l.material_grade,
      finish: cur.finish?.trim() ? cur.finish : l.finish,
      open_style: cur.open_style?.trim() ? cur.open_style : l.open_style,
      pcs_per_ctn: cur.pcs_per_ctn ?? l.pcs_per_ctn,
      kg_per_m: cur.kg_per_m ?? l.kg_per_m,
      kg_per_unit: cur.kg_per_unit ?? l.kg_per_unit,
      pack_size: cur.pack_size ?? l.pack_size,
      pack_unit: cur.pack_unit?.trim() ? cur.pack_unit : l.pack_unit,
      m3_per_unit: cur.m3_per_unit ?? l.m3_per_unit,
      warranty_text: cur.warranty_text?.trim() ? cur.warranty_text : l.warranty_text,
      material_id: l.material_id,
    })
  }
  return out
}

/**
 * MỘT ĐỀ XUẤT cập nhật danh mục — hiện trong hộp xác nhận sau khi lưu đơn
 * (user chốt 13/08/2026: KHÔNG tự ghi ngầm; người soạn thấy danh sách và bấm
 * "Cập nhật danh mục" mới ghi).
 */
export type SuggestField = {
  field: keyof CatalogFields | 'last_purchase_price'
  label: string
  value: string | number
  /**
   * ĐÈ giá trị đang có (chỉ `last_purchase_price`). Thiếu cờ này = fill-empty:
   * hộp xác nhận và endpoint enrich đọc CÙNG một cờ, nên không có đường nào để
   * lời hứa trên màn hình khác việc server làm.
   */
  overwrite?: true
  /** Giá trị danh mục ĐANG có — chỉ dùng cho trường đè, để hộp nói "8.200 → 8.500". */
  before?: string | number | null
}

export type CatalogSuggestion = {
  material_id: string
  code: string
  name: string
  fields: SuggestField[]
}

/** Nhãn hiện trong hộp xác nhận — khớp MATERIAL_FIELD_LABELS của form khai. */
const SUGGEST_LABELS: Record<keyof CatalogFields | 'last_purchase_price', string> = {
  spec: 'Quy cách',
  material_grade: 'Vật liệu / màu',
  finish: 'Màu / bề mặt',
  open_style: 'Cách mở thùng',
  pcs_per_ctn: 'SP mỗi thùng',
  kg_per_m: 'kg / m',
  kg_per_unit: 'kg / đơn vị',
  pack_size: 'Quy cách đóng gói',
  pack_unit: 'ĐVT đóng gói',
  m3_per_unit: 'm³ / đơn vị',
  warranty_text: 'Bảo hành',
  last_purchase_price: 'Giá mua gần nhất',
}

/**
 * Danh sách đề xuất cho hộp xác nhận: dòng đơn có gì mà danh mục đang TRỐNG.
 * Chỉ đề xuất — việc GHI đi qua endpoint enrich, nơi kiểm lại fill-empty lần
 * nữa trên bản danh mục mới nhất (chống đè khi có người vừa khai song song).
 */
export function buildCatalogSuggestions(
  lines: CatalogLineInfo[],
  materials: (CatalogFields & {
    id: string
    code: string
    name: string
    last_purchase_price?: number | null
  })[],
  /**
   * Tiền tệ của đơn + giá từng dòng — có thì hộp xác nhận hỏi luôn phần GIÁ
   * (user chốt 29/08). Bỏ trống thì hộp chỉ có phần mô tả như trước.
   */
  price?: { currency: string; byMaterial: Map<string, number> },
): CatalogSuggestion[] {
  const byId = new Map(materials.map((m) => [m.id, m]))
  const out: CatalogSuggestion[] = []
  for (const [materialId, line] of linesByMaterial(lines)) {
    const m = byId.get(materialId)
    if (!m) continue
    const fields: SuggestField[] = (
      Object.entries(catalogFillPatch(m, line) ?? {}) as [
        keyof CatalogFields,
        string | number,
      ][]
    ).map(([field, value]) => ({ field, label: SUGGEST_LABELS[field], value }))

    if (price) {
      const chg = priceChange(
        { last_purchase_price: m.last_purchase_price ?? null },
        price.currency,
        price.byMaterial.get(materialId),
      )
      if (chg) {
        fields.push({
          field: 'last_purchase_price',
          label: SUGGEST_LABELS.last_purchase_price,
          value: chg.after,
          overwrite: true,
          before: chg.before,
        })
      }
    }

    if (fields.length === 0) continue
    out.push({ material_id: materialId, code: m.code, name: m.name, fields })
  }
  return out
}

/**
 * Giá cập nhật khi đơn GỬI NCC: chỉ VND, chỉ dòng vật tư kho có giá > 0.
 * Trả map material_id → giá; cùng mã nhiều dòng thì lấy dòng CUỐI (giá chốt
 * sau cùng trên đơn).
 */
export function lastPriceUpdates(
  currency: string,
  lines: { material_id?: string | null; unit_price?: number | null }[],
): Map<string, number> {
  const out = new Map<string, number>()
  if (currency !== 'VND') return out
  for (const l of lines) {
    const price = Number(l.unit_price)
    if (l.material_id && Number.isFinite(price) && price > 0) {
      out.set(l.material_id, price)
    }
  }
  return out
}

/**
 * QUY CÁCH SUY TỪ DÒNG ĐƠN — vá chỗ hở của hộp xác nhận (28/08/2026).
 *
 * Mẫu bao bì carton không có ô "Quy cách": người mua gõ **Lọt lòng D×R×C**, ba
 * số ấy vào `inner_*_mm` của DÒNG chứ không vào `spec`. Mẫu kính/xốp thì gõ ô
 * **Quy cách** riêng của dòng (`dimension_text`). Hệ quả trước đây: hộp "Cập
 * nhật kho vật tư?" không bao giờ đề xuất quy cách cho hai mẫu này — muốn đẩy
 * về danh mục phải biết mà bấm cái link `lưu quy cách ↑` bé xíu trên dòng, tức
 * là CÙNG MỘT MÀN có hai đường đưa thông tin về danh mục và người dùng không
 * đoán được cái nào đi đâu.
 *
 * Nay một đường: dòng nào suy ra được quy cách thì hộp xác nhận đề xuất luôn.
 * Chuỗi sinh ra giữ đúng khuôn `900x605x115` mà link cũ vẫn ghi, để hai lối
 * không đẻ ra hai kiểu chữ khác nhau trong cùng một cột.
 */
export function specFromLine(l: {
  spec?: string | null
  /** Nhận cả `''` vì lưới ở client giữ ô số rỗng là chuỗi (kiểu `Num`). */
  inner_l_mm?: number | string | null
  inner_w_mm?: number | string | null
  inner_h_mm?: number | string | null
  dimension_text?: string | null
}): string | null {
  const typed = (l.spec ?? '').trim()
  if (typed) return typed // gõ thẳng thì không suy diễn gì

  const dims = [l.inner_l_mm, l.inner_w_mm, l.inner_h_mm].map((v) => Number(v))
  if (dims.every((d) => Number.isFinite(d) && d > 0)) {
    return `${dims[0]}x${dims[1]}x${dims[2]}`
  }

  // Kính/xốp: chỉ nhận khi ô quy cách của dòng ĐỌC RA được D×R×C — chuỗi mô tả
  // linh tinh không đáng đẩy vào danh mục dùng chung.
  const text = (l.dimension_text ?? '').trim()
  return text && parseInnerDims(text) != null ? text : null
}
