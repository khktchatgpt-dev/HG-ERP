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
