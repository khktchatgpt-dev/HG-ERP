/**
 * NGUYÊN NHÂN ĐIỀU CHỈNH ĐƠN MUA (0227, chốt 07/10/2026).
 *
 * Mỗi lần điều chỉnh đơn đã duyệt mang một nguyên nhân CỐ ĐỊNH (không phải chữ
 * tự do) để lịch sử lọc và tra ngược được — "đơn mua nào đã sửa theo thay đổi
 * của khách". "Khách đổi đơn" bắt buộc chỉ ra lệnh / đơn khách mà lần sửa theo.
 *
 * Thuần, không chạm DB: dùng chung cho hộp Áp dụng (client), zod (server) và test.
 * Danh sách khoá phải khớp check constraint ở migration 0227.
 */
export const ADJ_CAUSES = [
  {
    key: 'khach_doi',
    label: 'Khách đổi đơn',
    hint: 'SL, mẫu, hạn giao của đơn khách thay đổi',
  },
  {
    key: 'ncc_doi',
    label: 'NCC đổi giá / điều kiện',
    hint: 'Tăng giá, đổi quy cách, hết hàng',
  },
  {
    key: 'ky_thuat',
    label: 'Kỹ thuật đổi định mức',
    hint: 'Lệnh ra bản chỉnh sửa, đổi vật tư',
  },
  {
    key: 'nhap_sai',
    label: 'Nhập sai, sửa cho đúng',
    hint: 'Đơn gốc gõ nhầm số, giá, mã',
  },
  { key: 'khac', label: 'Khác', hint: 'Ghi rõ ở ghi chú' },
] as const

export type AdjCause = (typeof ADJ_CAUSES)[number]['key']

export const ADJ_CAUSE_KEYS = ADJ_CAUSES.map((c) => c.key) as [AdjCause, ...AdjCause[]]

/** Nhãn hiển thị; bản ghi cũ (trước 0227) không có nguyên nhân → "Chưa phân loại". */
export function causeLabel(cause: string | null | undefined): string {
  return ADJ_CAUSES.find((c) => c.key === cause)?.label ?? 'Chưa phân loại'
}

/** Nguyên nhân nào BẮT BUỘC chỉ ra lệnh (Q2). */
export function causeNeedsLsx(cause: string | null | undefined): boolean {
  return cause === 'khach_doi'
}

/** Nguyên nhân nào bày ô chọn lệnh — Kỹ thuật đổi định mức cũng theo một lệnh, nhưng không bắt. */
export function causeShowsLsx(cause: string | null | undefined): boolean {
  return cause === 'khach_doi' || cause === 'ky_thuat'
}

/**
 * Lệnh đơn mua đang gắn, theo thứ tự: lệnh chính → lệnh gộp thêm →
 * lệnh trong phần chia SL từng dòng (`splitIds`). Không trùng. Đây là danh sách
 * gợi ý của hộp Áp dụng.
 */
export function linkedLsxIds(
  mainId: string | null | undefined,
  extraIds: readonly string[],
  splitIds: readonly string[],
): string[] {
  const out: string[] = []
  for (const id of [mainId, ...extraIds, ...splitIds]) if (id && !out.includes(id)) out.push(id)
  return out
}

/** Lệnh chọn sẵn: đơn chỉ gắn MỘT lệnh thì chọn luôn; gắn nhiều thì để người mua chọn. */
export function defaultLsxPick(linked: readonly string[]): string[] {
  return linked.length === 1 ? [linked[0]] : []
}

/** Ghi chú tối thiểu — giữ đúng luật cũ của ô lý do (server cũng đòi). */
export const ADJ_NOTE_MIN = 5

/**
 * Vì sao chưa áp dụng được — một câu, null là đủ. Thứ tự = thứ tự ô trong hộp,
 * để câu chặn luôn chỉ vào ô đầu tiên còn thiếu.
 */
export function causeBlock(input: {
  cause: string | null
  lsxIds: readonly string[]
  note: string
}): { field: 'cause' | 'lsx' | 'note'; text: string } | null {
  if (!input.cause)
    return {
      field: 'cause',
      text: 'Chọn nguyên nhân để kế toán và Bán hàng biết vì sao đơn đổi.',
    }
  if (causeNeedsLsx(input.cause) && input.lsxIds.length === 0)
    return {
      field: 'lsx',
      text: 'Khách đổi đơn: chọn lệnh / đơn khách mà lần sửa này theo.',
    }
  if (input.note.trim().length < ADJ_NOTE_MIN)
    return {
      field: 'note',
      text: `Ghi chú ít nhất ${ADJ_NOTE_MIN} ký tự: đổi gì, báo NCC qua đâu.`,
    }
  return null
}
