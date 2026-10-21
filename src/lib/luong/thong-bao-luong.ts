/**
 * Câu thông báo của luồng lương (21/10/2026: Nhân sự chốt công → hệ thống tính → chị Phụng
 * kiểm, sửa → gửi sếp duyệt). Hàm thuần để test; handler `luong.notifications` gửi đi.
 *
 * Số trong câu là số của CHÍNH lần tính vừa chạy (nguyên tắc "con số là một lời hứa"): bấm
 * vào thông báo, màn Bảng lương phải bày đúng số đó.
 */

const kyVn = (thang: string) => `${thang.slice(5)}/${thang.slice(0, 4)}`
const tien = (n: number) => Math.round(n).toLocaleString('vi-VN')

export const hrefBangLuong = (thang: string) => `/bang-luong?thang=${thang}`
/** Màn duyệt của sếp (Hộp ký › Bảng lương). */
export const hrefDuyetLuong = (thang: string) => `/exec/approvals/luong/${thang}`

/** Chị Phụng gửi bảng lương — báo sếp. */
export const tieuDeGui = (thang: string, nguoi: number, thucLinh: number) =>
  `Bảng lương ${kyVn(thang)} chờ duyệt: ${nguoi} người, thực lĩnh ${tien(thucLinh)}`

/** Nhân sự chốt công, hệ thống đã tính bảng nháp. */
export function tieuDeDaTinh(
  thang: string,
  lan: number,
  r: { nguoi: number; thucLinh: number; vuong: number },
): string {
  const dau =
    lan > 1
      ? `Kỳ công ${kyVn(thang)} chốt lại (lần ${lan}) — bảng lương nháp đã tính lại`
      : `Kỳ công ${kyVn(thang)} đã chốt — bảng lương nháp đã tính sẵn`
  const vuong = r.vuong ? ` · ${r.vuong} người còn vướng (thiếu hồ sơ / STK)` : ''
  return `${dau}: ${r.nguoi} người, thực lĩnh ${tien(r.thucLinh)}${vuong}`
}

/** Chốt công nhưng bảng lương đã gửi duyệt trở đi — không tự tính đè. */
export const tieuDeKhongTinh = (thang: string) =>
  `Kỳ công ${kyVn(thang)} đã chốt — bảng lương đang chờ duyệt / đã duyệt nên KHÔNG tự tính lại`

/** Tự tính hỏng — kỳ công vẫn chốt; người quản lý lương bấm Tính tay. */
export const tieuDeTinhLoi = (thang: string, loi: string) =>
  `Kỳ công ${kyVn(thang)} đã chốt nhưng hệ thống chưa tính được lương: ${loi.slice(0, 160)} — vào Bảng lương bấm Tính`

/** Sếp quyết bảng lương — báo người gửi. */
export function tieuDeQuyet(thang: string, duyet: boolean, lyDo: string | null): string {
  return duyet
    ? `Sếp đã duyệt bảng lương ${kyVn(thang)} — chuyển khoản rồi ghi Đã chi`
    : `Sếp trả lại bảng lương ${kyVn(thang)}: “${(lyDo ?? '').slice(0, 160)}”`
}
