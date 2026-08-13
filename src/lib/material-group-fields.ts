/**
 * THÔNG SỐ THEO NHÓM VẬT TƯ (0137) — mỗi loại vật tư cần một bộ thông tin khác
 * nhau, và form khai phải hỏi ĐÚNG bộ đó thay vì bày mọi ô cho mọi loại.
 *
 * Trục là NHÓM CHÍNH của danh mục (14 nhóm thật — trường bắt buộc khi khai
 * nhanh, danh sách chốt nên map thẳng theo tên được). Cấu hình quyết định:
 *   · ô riêng nào hiện thêm (cách mở + pcs/thùng cho bao bì, màu/bề mặt cho
 *     kim loại) — cột DB tương ứng thêm ở 0137;
 *   · placeholder của Quy cách / Vật liệu đổi theo loại — quy cách đúng dạng
 *     thì form đơn TỰ BÓC kích thước (carton lọt lòng, kính m²/tấm, xốp m³).
 *
 * Logic thuần, testable — form khai (MaterialCoreFields) chỉ đọc cấu hình.
 */

export type GroupFieldConfig = {
  /** Bao bì: cách mở thùng (AD/MR/ĐK) + số SP mỗi thùng. */
  showCarton: boolean
  /** Kim loại: màu / bề mặt ("inox bóng", "xi trắng") — cột finish. */
  showFinish: boolean
  specPlaceholder: string
  specHint: string
  gradePlaceholder: string
}

const DEFAULT: GroupFieldConfig = {
  showCarton: false,
  showFinish: false,
  specPlaceholder: '25×25×1.2mm (cây 6m) · dày 18mm…',
  specHint: 'Tự điền vào dòng đơn khi chọn vật tư.',
  gradePlaceholder: 'Nhựa đen · Sắt xi trắng · inox 201…',
}

/** Khớp nhóm theo TỪ KHOÁ không dấu — tên nhóm dài, gõ đủ dễ lệch một ký tự. */
function nod(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
}

export function groupFieldConfig(groupName: string | null | undefined): GroupFieldConfig {
  const g = nod(groupName ?? '')
  if (!g) return DEFAULT

  if (g.includes('bao bi')) {
    return {
      ...DEFAULT,
      showCarton: true,
      specPlaceholder: '900x605x115 (lọt lòng D×R×C, mm)',
      specHint:
        'Ghi lọt lòng dạng D×R×C — form đơn tự tách vào ba ô và tính m²/thùng theo cách mở.',
      gradePlaceholder: 'Carton 5 lớp, sóng BC…',
    }
  }
  if (g.includes('sat thep') || g.includes('inox') || g.includes('nhom')) {
    return {
      ...DEFAULT,
      showFinish: true,
      specPlaceholder: '25×50×1.2mm (cây 6m)…',
      gradePlaceholder: 'Inox 304 · sắt CT3 · nhôm 6063…',
    }
  }
  if (g.includes('go - kinh') || g.includes('kinh') || g.includes('nhua tam')) {
    return {
      ...DEFAULT,
      specPlaceholder: '605x539x5mm (D×R×dày)',
      specHint: 'Ghi D×R×dày — mẫu đơn kính tự tính m²/tấm từ chính chuỗi này.',
      gradePlaceholder: 'Kính trắng phun mờ, cường lực…',
    }
  }
  if (g.includes('mut') || g.includes('xop')) {
    return {
      ...DEFAULT,
      specPlaceholder: '1520x920x10 (D×R×dày, mm)',
      specHint: 'Xốp tấm ghi D×R×dày — mẫu đơn xốp tự tính m³ từ chính chuỗi này.',
      gradePlaceholder: 'Xốp 10kg · mút dai D40…',
    }
  }
  if (g.includes('vai') || g.includes('may')) {
    return {
      ...DEFAULT,
      specPlaceholder: 'Dây dẹp 8mm · khổ 1.6m…',
      gradePlaceholder: 'Định mức 5m/g = 32-34g…',
    }
  }
  if (g.includes('son') || g.includes('hoa chat')) {
    return {
      ...DEFAULT,
      specPlaceholder: '25kg/bao · 5kg/lon…',
      gradePlaceholder: 'Mã màu NCC: T67443C (C679-ASA)…',
    }
  }
  return DEFAULT
}

/* ────────────────────────────────────────────────────────────────────────────
 * ĐỢT 2 CẢI THIỆN VẬT TƯ (13/08/2026 — docs/vat-tu-ke-hoach-cai-thien-thiet-ke.md)
 * Hai helper thuần cho form khai: cảnh báo trước khi null đè, và danh sách
 * trường "khai vội" để Kho rà đúng chỗ.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Nhãn tiếng Việt của các trường hay bị null đè / hay khai thiếu. */
export const MATERIAL_FIELD_LABELS: Record<string, string> = {
  spec: 'Quy cách',
  sub_group: 'Nhóm phụ',
  material_grade: 'Vật liệu / màu',
  kg_per_m: 'kg/m',
  default_bar_length_m: 'Dài cây (m)',
  kg_per_unit: 'kg/đơn vị',
  open_style: 'Cách mở thùng',
  pcs_per_ctn: 'SP mỗi thùng',
  finish: 'Màu / bề mặt',
  pack_size: 'Đóng gói khi mua',
  pack_unit: 'Đơn vị đóng gói',
  unit2_factor: 'Hệ số quy đổi giá',
}

export type ClearedField = { field: string; label: string; oldValue: string }

/**
 * NHỮNG TRƯỜNG SẮP BỊ NULL ĐÈ khi lưu — nền của xác nhận 2 nhịp lúc đổi nhóm.
 *
 * `corePayload()` cố ý ghi null cho trường ngoài nhóm/diện hiện tại (đổi nhóm
 * không để sót số cũ — 0137). Đúng về dữ liệu nhưng là XOÁ TRONG IM LẶNG với
 * người lỡ tay đổi nhóm: mất kg/m, cách mở thùng… không cảnh báo, không hoàn
 * tác. Hàm này so bản đã lưu với payload sắp gửi và trả danh sách trường đang
 * có giá trị mà sắp thành null — form liệt kê ra và bắt xác nhận rồi mới lưu.
 *
 * Chỉ soi chiều CÓ GIÁ TRỊ → NULL. Đổi giá trị (0.248 → 0.25) là chuyện thường
 * của việc sửa, không cảnh báo — tránh cảnh báo giả kiểu '0.2480' vs 0.248
 * (rủi ro ghi ở kế hoạch đợt 2).
 */
export function fieldsClearedByPayload(
  original: Record<string, unknown>,
  payload: Record<string, unknown>,
): ClearedField[] {
  const out: ClearedField[] = []
  for (const field of Object.keys(MATERIAL_FIELD_LABELS)) {
    if (!(field in payload) || payload[field] !== null) continue
    const old = original[field]
    if (old == null) continue
    const text = String(old).trim()
    if (text === '') continue
    out.push({ field, label: MATERIAL_FIELD_LABELS[field], oldValue: text })
  }
  return out
}

/**
 * TRƯỜNG "KHAI VỘI" — người soạn đơn khai nhanh vật tư thường bỏ trống gì?
 *
 * needs_review một cờ chung (0136) bắt Kho rà CẢ bản ghi mà không biết chỗ nào
 * đáng ngờ. Hàm này chấm đúng các trường ĐANG TRỐNG mà nhóm/mẫu của vật tư
 * thật sự cần — lưu vào `needs_review_fields` (0138), màn Kho hiện chip từng
 * trường. Trả về KEY (ổn định để lưu DB), nhãn tra `MATERIAL_FIELD_LABELS`.
 */
export function quickReviewFields(
  f: {
    spec: string
    sub_group: string
    material_grade: string
    kg_per_m: string
    kg_per_unit: string
    open_style: string
    pcs_per_ctn: string
    finish: string
  },
  ctx: {
    groupCfg: GroupFieldConfig
    /** Mẫu đoán ra cần barem theo mét (nhôm/inox hàng cây). */
    needsBarWeight: boolean
    /** Hàng tấm/cuộn thuộc mẫu cân kg — cần kg/đơn vị thay vì kg/m. */
    needsSheetWeight: boolean
    /** kg/m máy đọc được từ tên — có thì ô trống không tính là thiếu. */
    derivedKg: number | null
  },
): string[] {
  const out: string[] = []
  if (!f.spec.trim()) out.push('spec')
  if (!f.sub_group.trim()) out.push('sub_group')
  if (!f.material_grade.trim()) out.push('material_grade')
  if (ctx.needsBarWeight && !f.kg_per_m.trim() && ctx.derivedKg == null)
    out.push('kg_per_m')
  if (ctx.needsSheetWeight && !f.kg_per_unit.trim()) out.push('kg_per_unit')
  if (ctx.groupCfg.showCarton && !f.open_style.trim()) out.push('open_style')
  if (ctx.groupCfg.showCarton && !f.pcs_per_ctn.trim()) out.push('pcs_per_ctn')
  if (ctx.groupCfg.showFinish && !f.finish.trim()) out.push('finish')
  return out
}
