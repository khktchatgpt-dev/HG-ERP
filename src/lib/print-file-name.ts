/**
 * Tên file gợi ý khi "Lưu PDF" phiếu in đơn mua: "PO-2026-0136_An Khanh" —
 * Chrome lấy `document.title` làm tên file (xem PrintToolbar). Bỏ ký tự
 * Windows cấm, cắt tên NCC dài.
 */
export function poPdfName(code: string, supplier: string | null | undefined): string {
  const clean = (s: string) =>
    s
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  const sup = supplier ? clean(supplier).slice(0, 60) : ''
  return sup ? `${clean(code)}_${sup}` : clean(code)
}
