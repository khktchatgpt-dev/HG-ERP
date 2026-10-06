/**
 * DẤU + CHỮ KÝ GIÁM ĐỐC TRÊN PHIẾU IN ĐƠN MUA (06/10/2026).
 *
 * Trước đây đơn đã duyệt trên hệ thống vẫn phải in ra cho Giám đốc ký tay, đóng
 * dấu. Nay phiếu tự in ảnh dấu + chữ ký, nhưng CHỈ khi chữ ký đó có thật trên
 * hệ thống — chủ dự án chốt:
 *  · Chỉ chữ ký anh Điền, chỉ đơn mua.
 *  · Chỉ đơn CHÍNH anh Điền bấm duyệt. Đơn người khác duyệt (đo 06/10: Thảo 37,
 *    Điền 28) in ô trống như cũ: in chữ ký một người lên quyết định của người
 *    khác là giả chữ ký, dù cùng công ty.
 *  · Trưởng phòng Kế hoạch vẫn ký tay.
 *
 * Thêm một luật tự đặt: đơn ĐIỀU CHỈNH dòng hàng/tiền sau lúc ký (sổ 0210) thì
 * không đóng dấu — nội dung trên tờ đã khác thứ Giám đốc duyệt.
 *
 * Thuần để test mọi nhánh; service gọi hàm này, lý do trả về hiện ở thanh nút
 * trang in để người in biết vì sao tờ không có dấu.
 */

export type StampGuard = { ok: true } | { ok: false; reason: string }

export type PoStampConfig = {
  /** Người duy nhất có chữ ký trong ảnh — `users.id`. */
  signer_user_id: string
  /** Đường dẫn ảnh PNG nền trong suốt trong bucket `private`. */
  path: string
}

export function poStampGuard(
  po: { status: string; approved_by: string | null; approved_at: string | null },
  cfg: PoStampConfig | null,
  adjs: { created_at: string }[],
  approverName?: string | null,
): StampGuard {
  if (!cfg) return { ok: false, reason: 'Chưa cài ảnh dấu + chữ ký Giám đốc' }
  if (po.status === 'cancelled') return { ok: false, reason: 'Đơn đã huỷ' }
  if (!po.approved_at || !po.approved_by) {
    return { ok: false, reason: 'Đơn chưa được duyệt trên hệ thống — ký tay như cũ' }
  }
  if (po.approved_by !== cfg.signer_user_id) {
    return {
      ok: false,
      reason: `Đơn do ${approverName ?? 'người khác'} duyệt — dấu và chữ ký chỉ in trên đơn Giám đốc tự duyệt`,
    }
  }
  const signedAt = Date.parse(po.approved_at)
  if (adjs.some((a) => Date.parse(a.created_at) > signedAt)) {
    return {
      ok: false,
      reason:
        'Đơn đã điều chỉnh sau khi Giám đốc ký — nội dung khác bản đã duyệt, ký tay bản mới',
    }
  }
  return { ok: true }
}

/** Đọc cấu hình từ bảng `settings` (key `po_stamp`) — sai hình thì coi như chưa cài. */
export function parseStampConfig(raw: unknown): PoStampConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (typeof r.signer_user_id !== 'string' || !r.signer_user_id) return null
  if (typeof r.path !== 'string' || !r.path) return null
  return { signer_user_id: r.signer_user_id, path: r.path }
}

/** Tên file PDF gợi ý: "PO-2026-0136_An Khanh.pdf" — bỏ ký tự Windows cấm. */
export function poPdfName(code: string, supplier: string | null | undefined): string {
  const clean = (s: string) =>
    s
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  const sup = supplier ? clean(supplier).slice(0, 60) : ''
  return sup ? `${clean(code)}_${sup}` : clean(code)
}
