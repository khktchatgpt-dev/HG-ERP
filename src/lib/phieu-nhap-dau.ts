/**
 * ĐẦU PHIẾU NHẬP — luật thuần của ba ô người lập hay bỏ trống (04/10/2026,
 * bản vẽ J1/J1b canvas "Cung ứng · Hàng về" › Bản 7, chủ dự án duyệt).
 *
 * Đo 04/10: 18 phiếu NV Cung ứng tự lập qua form từ 01/10 thì 0/18 có người
 * giao, 0/18 có số phiếu NCC, 0/18 có ghi chú. Ba cách gỡ:
 *  · Người giao điền SẴN tên NCC (sửa được) — trống là mặc định tệ nhất.
 *  · Số phiếu NCC KHÔNG bắt buộc (nhiều chuyến NCC không đưa phiếu) nhưng
 *    trống thì NHẮC một lần lúc Ghi sổ, ô nhập ngay trong hộp nhắc.
 *  · Ô Ghi chú phiếu mới — in lên 01-VT; dấu "Sửa lại PNK-…" vẫn đứng đầu vì
 *    `suaLaiTu` (lib/da-ve) đọc nó để nối phiếu cũ → mới.
 */

/** Người giao ban đầu: phiếu lập lại giữ của phiếu cũ; trống thì tên NCC. */
export function nguoiGiaoBanDau(
  suaLai: { counterparty: string } | null | undefined,
  supplierName: string,
): string {
  return suaLai?.counterparty.trim() || supplierName.trim()
}

/** Ghi chú ghi vào phiếu: dấu sửa phiếu (nếu có) + ghi chú người lập gõ. */
export function ghiChuPhieu(
  suaLai: { code: string; daoBoi: string } | null | undefined,
  ghiChu: string,
): string | null {
  return (
    [
      suaLai ? `Sửa lại ${suaLai.code} (đã đảo bởi ${suaLai.daoBoi})` : null,
      ghiChu.trim(),
    ]
      .filter(Boolean)
      .join(' · ') || null
  )
}

/** Trần ô ghi chú phiếu — schema cho 2000 nhưng server còn nối lý do nhận vượt (≤500) vào sau. */
export const GHI_CHU_TOI_DA = 1000

/** Bấm Ghi sổ có phải hỏi số phiếu NCC trước không. */
export function canNhacSoNcc(supplierDocNo: string): boolean {
  return supplierDocNo.trim() === ''
}
