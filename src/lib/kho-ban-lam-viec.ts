/**
 * BÀN LÀM VIỆC KHO — luật ô việc (Kho B8a, bản vẽ BLV-1 duyệt 19/10/2026:
 * https://claude.ai/artifact/PvUSfGoMDrT7nMjGz4yezC). Thuần, có test.
 *
 * Mỗi ô là một LỜI HỨA: số trên ô = số dòng thấy được khi bấm vào, vì loader
 * đếm bằng ĐÚNG hàm của màn đích (Hàng về: `incomingBucket`; Tồn kho theo lệnh:
 * `roCuaLenh`; Tồn kho theo mã: rổ `low` / `short`; Sổ phiếu: rổ `thieu_ncc`;
 * Kiểm kê: `thuocRo`; Đề nghị mua: rổ "Kho cần làm"). Hai chỗ khác bản vẽ vì
 * màn đích không tách: "quá hạn" + "≤ 7 ngày" là MỘT rổ của Theo lệnh; "thiếu
 * số phiếu NCC" đếm cả sổ như tab Sổ phiếu, số 14 ngày ghi ở dòng phụ.
 *
 * Ô 0 vẫn hiện, chữ nhạt — hết việc là tốt, không tô đỏ.
 */

export type SoBan = {
  hangVe: { overdue: number; today: number; week: number }
  thieuNcc: { tong: number; ganDay: number }
  lenh: { con: number; conMa: number; han: number; hanTen: string[]; xong: number }
  ton: { low: number; short: number }
  kiemKe: { lam: number; cho: number }
  deNghi: { viec: number }
}

export type ToneO = 'stop' | 'warn' | 'b' | 'z'

export type OViec = {
  key: string
  n: number
  t: string
  s: string
  href: string
  tone: ToneO
}

export type NhomViec = { key: string; ten: string; o: OViec[] }

const o = (
  key: string,
  n: number,
  t: string,
  s: string,
  href: string,
  tone: Exclude<ToneO, 'z'>,
): OViec => ({
  // prettier-ignore
  key,
  n,
  t,
  s,
  href,
  tone: n === 0 ? 'z' : tone,
})

const nf = (n: number) => n.toLocaleString('vi-VN')

export function dungBanLamViec(so: SoBan): NhomViec[] {
  const hanTen = so.lenh.hanTen.slice(0, 2).join(' · ')
  return [
    {
      key: 'nhan',
      ten: 'Nhận hàng',
      o: [
        o('qua-hen', so.hangVe.overdue, 'Quá hẹn chưa về', 'Hàng về › Quá hẹn', '/warehouse/nhap?hen=overdue', 'stop'), // prettier-ignore
        o('hom-nay', so.hangVe.today, 'Hẹn về hôm nay', 'Hàng về › Hôm nay', '/warehouse/nhap?hen=today', 'warn'), // prettier-ignore
        o('tuan', so.hangVe.week, 'Về trong 7 ngày tới', 'để xếp chỗ, gọi người bốc', '/warehouse/nhap?hen=week', 'b'), // prettier-ignore
        o('thieu-ncc', so.thieuNcc.tong, 'Phiếu thiếu số phiếu NCC', so.thieuNcc.ganDay ? `${nf(so.thieuNcc.ganDay)} trong 14 ngày · Sổ phiếu` : 'Sổ phiếu', '/warehouse/phieu?ro=thieu_ncc', 'warn'), // prettier-ignore
      ],
    },
    {
      key: 'xuat',
      ten: 'Xuất cho lệnh',
      o: [
        o('lenh-con', so.lenh.con, 'Lệnh còn hàng chưa ghi xuất', so.lenh.conMa ? `${nf(so.lenh.conMa)} mã · Tồn kho › Theo lệnh` : 'Tồn kho › Theo lệnh', '/warehouse/ton?xem=lenh&ro=con', 'stop'), // prettier-ignore
        o('lenh-han', so.lenh.han, 'Quá hạn / hạn xuất ≤ 7 ngày', hanTen || 'không có', '/warehouse/ton?xem=lenh&ro=han', 'stop'), // prettier-ignore
        o('lenh-xong', so.lenh.xong, 'Lệnh xong chưa ghi xuất', so.lenh.xong ? 'xuất bổ sung hoặc về tồn chung' : 'không có', '/warehouse/ton?xem=lenh&ro=xong', 'warn'), // prettier-ignore
      ],
    },
    {
      key: 'ton',
      ten: 'Tồn · kiểm kê · đề nghị',
      o: [
        o('duoi-muc', so.ton.low, 'Mã dưới mức tối thiểu', 'Tồn kho › Dưới mức', '/warehouse/ton?ro=low', 'stop'), // prettier-ignore
        o('thieu-lenh', so.ton.short, 'Tồn ít hơn phần của lệnh', 'Tồn kho › Thiếu cho lệnh', '/warehouse/ton?ro=short', 'warn'), // prettier-ignore
        o('kiem-ke', so.kiemKe.lam + so.kiemKe.cho, 'Kiểm kê đang làm / chờ duyệt', so.kiemKe.cho ? `${so.kiemKe.cho} đợt chờ duyệt` : 'Kiểm kê', so.kiemKe.cho ? '/warehouse/kiem-ke?ro=cho' : '/warehouse/kiem-ke', 'warn'), // prettier-ignore
        o('de-nghi', so.deNghi.viec, 'Đề nghị mua Kho cần làm', 'nháp · bị từ chối', '/warehouse/de-nghi', 'warn'), // prettier-ignore
      ],
    },
  ]
}

/** "trễ N ngày" / "hôm nay" / "dd/mm" cho cột hẹn của bảng hàng về. */
export function nhanHen(
  expected: string | null,
  today: string,
): { chu: string; tone: ToneO } {
  if (!expected) return { chu: 'chưa hẹn', tone: 'z' }
  if (expected === today) return { chu: 'hôm nay', tone: 'warn' }
  const ngay = Math.round((Date.parse(today) - Date.parse(expected)) / 86_400_000)
  const dm = `${expected.slice(8, 10)}/${expected.slice(5, 7)}`
  return ngay > 0
    ? { chu: `${dm} · trễ ${ngay} ngày`, tone: 'stop' }
    : { chu: dm, tone: 'b' }
}
