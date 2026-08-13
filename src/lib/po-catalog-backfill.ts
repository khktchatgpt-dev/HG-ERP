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

/** Trường mô tả trên dòng đơn có thể chảy về danh mục. */
export type CatalogLineInfo = {
  material_id?: string | null
  spec?: string | null
  material_grade?: string | null
  finish?: string | null
  open_style?: string | null
  pcs_per_ctn?: number | null
}

/** Trường tương ứng của bản ghi danh mục — null/'' coi là TRỐNG. */
export type CatalogFields = {
  spec: string | null
  material_grade: string | null
  finish: string | null
  open_style: string | null
  pcs_per_ctn: number | null
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
  return Object.keys(patch).length > 0 ? patch : null
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
      material_id: l.material_id,
    })
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
