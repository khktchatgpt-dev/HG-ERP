/**
 * HÔM NAY — luật số của trang đầu khu Kho `/warehouse` (B2 "Kho cho người mới",
 * bản vẽ A https://claude.ai/artifact/QpEkCkMHdMhFhF3WYhEF7z, duyệt Q1 27/10/2026).
 * Thay Bàn làm việc B8a (12 ô chia 3 nhóm, 95 con số ở màn đầu): người mới không
 * biết bắt đầu từ ô nào. Thuần, có test.
 *
 * Bốn việc, mỗi việc vài con số và MỘT nút. Mỗi số là một LỜI HỨA: bằng đúng số
 * dòng thấy khi bấm vào, vì loader đếm bằng hàm của màn đích (Nhận hàng:
 * `incomingBucket`; Tồn kho theo lệnh: `roCuaLenh`; Tồn kho theo mã: rổ `has` /
 * `low` / `short`; Kiểm kê: `thuocRo`). Số 0 vẫn hiện, chữ nhạt — hết việc là
 * tốt, không tô đỏ.
 */

export type SoBan = {
  hangVe: { tong: number; overdue: number; today: number; week: number }
  thieuNcc: { tong: number; ganDay: number }
  lenh: { con: number; conMa: number; han: number; hanTen: string[]; xong: number }
  ton: { has: number; low: number; short: number }
  kiemKe: { lam: number; cho: number }
  deNghi: { viec: number }
}

export type ToneO = 'stop' | 'warn' | 'b' | 'z'

/** Một con số bấm được trong khối việc. */
export type SoViec = { key: string; n: number; t: string; href: string; tone: ToneO }

export type KhoiViec = {
  key: 'nhan' | 'xuat' | 'tra' | 'cap-nhat'
  ten: string
  /** Dòng phụ cạnh tên khối. */
  phu: string
  so: SoViec[]
  /** Nút chính của khối; null = khối có ô tìm thay nút (Tra tồn). */
  nut: { chu: string; href: string } | null
  /** Một câu nhắc việc gấp — null khi không có gì gấp. */
  nhac: string | null
}

const nf = (n: number) => n.toLocaleString('vi-VN')

const so = (
  key: string,
  n: number,
  t: string,
  href: string,
  tone: Exclude<ToneO, 'z'>,
): SoViec => ({ key, n, t, href, tone: n === 0 ? 'z' : tone })

export function dungHomNay(s: SoBan): KhoiViec[] {
  const gap = s.lenh.hanTen.slice(0, 2).join(' · ')
  return [
    {
      key: 'nhan',
      ten: 'Nhận hàng NCC',
      phu: `${nf(s.hangVe.tong)} đơn đang về`,
      so: [
        so('qua-hen', s.hangVe.overdue, 'quá hẹn chưa về', '/warehouse/nhap?hen=overdue', 'stop'), // prettier-ignore
        so('hom-nay', s.hangVe.today, 'hẹn về hôm nay', '/warehouse/nhap?hen=today', 'warn'), // prettier-ignore
        so('tuan', s.hangVe.week, 'về trong 7 ngày', '/warehouse/nhap?hen=week', 'b'),
      ],
      nut: { chu: 'Nhận hàng', href: '/warehouse/nhap' },
      nhac: s.hangVe.overdue
        ? `${nf(s.hangVe.overdue)} đơn quá hẹn có thể đã về mà chưa ai ghi phiếu`
        : null,
    },
    {
      key: 'xuat',
      ten: 'Xuất cho tổ',
      phu: 'theo lệnh sản xuất',
      so: [
        so('lenh-con', s.lenh.con, 'lệnh còn hàng chưa ghi xuất', '/warehouse/ton?xem=lenh&ro=con', 'stop'), // prettier-ignore
        so('lenh-han', s.lenh.han, 'quá hạn / hạn xuất ≤ 7 ngày', '/warehouse/ton?xem=lenh&ro=han', 'stop'), // prettier-ignore
        so('lenh-xong', s.lenh.xong, 'lệnh đã xong chưa ghi xuất', '/warehouse/ton?xem=lenh&ro=xong', 'warn'), // prettier-ignore
      ],
      nut: { chu: 'Ghi phiếu xuất', href: '/warehouse/xuat' },
      nhac: gap ? `Gấp: ${gap}` : null,
    },
    {
      key: 'tra',
      ten: 'Tra tồn',
      phu: `${nf(s.ton.has)} mã đang có hàng`,
      so: [
        so('duoi-muc', s.ton.low, 'dưới mức tối thiểu', '/warehouse/ton?ro=low', 'stop'),
        so('thieu-lenh', s.ton.short, 'tồn ít hơn phần của lệnh', '/warehouse/ton?ro=short', 'warn'), // prettier-ignore
      ],
      nut: null,
      nhac: null,
    },
    {
      key: 'cap-nhat',
      ten: 'Cập nhật số thực tế',
      phu: 'khi số trên máy lệch kệ',
      so: [
        so('kk-lam', s.kiemKe.lam, 'đợt kiểm kê đang làm', '/warehouse/kiem-ke?ro=lam', 'warn'), // prettier-ignore
        so('kk-cho', s.kiemKe.cho, 'đợt chờ duyệt', '/warehouse/kiem-ke?ro=cho', 'warn'),
      ],
      nut: { chu: 'Cập nhật số thực tế', href: '/warehouse/cap-nhat-ton' },
      nhac: null,
    },
  ]
}

/** Một việc đang dở của người đang xem. */
export type ViecDo = { key: string; chu: string; href: string }

/**
 * "ĐANG DỞ CỦA BẠN" — việc đã bắt đầu mà chưa xong. Kho không lưu phiếu gõ dở
 * trên máy chủ, nên nguồn là thứ CÓ trên sổ: đợt kiểm kê mình mở / được phân
 * đếm, lần cập nhật chờ duyệt (trưởng kho thấy "chờ bạn duyệt"), đề nghị mua
 * nháp, phiếu nhập thiếu số phiếu NCC trong 14 ngày.
 */
export function dungDangDo(input: {
  laTruong: boolean
  choDuyet: { id: string; code: string; nguoi: string | null; so_ma: number }[]
  dotLam: { id: string; code: string; trang_thai: string }[]
  deNghiNhap: number
  thieuNccGanDay: number
}): ViecDo[] {
  const out: ViecDo[] = []
  for (const c of input.choDuyet)
    out.push({
      key: `cho-${c.id}`,
      chu: input.laTruong
        ? `${c.code} · ${c.nguoi ?? '?'} cập nhật ${c.so_ma} mã — chờ bạn duyệt`
        : `${c.code} · cập nhật ${c.so_ma} mã — chờ trưởng kho duyệt`,
      href: `/warehouse/kiem-ke/${c.id}`,
    })
  for (const d of input.dotLam)
    out.push({
      key: `dot-${d.id}`,
      chu: `Đợt kiểm kê ${d.code} — ${d.trang_thai}`,
      href: `/warehouse/kiem-ke/${d.id}`,
    })
  if (input.deNghiNhap > 0)
    out.push({
      key: 'de-nghi',
      chu: `${nf(input.deNghiNhap)} đề nghị mua đang nháp`,
      href: '/warehouse/de-nghi',
    })
  if (input.thieuNccGanDay > 0)
    out.push({
      key: 'thieu-ncc',
      chu: `${nf(input.thieuNccGanDay)} phiếu nhập 14 ngày qua chưa ghi số phiếu NCC`,
      href: '/warehouse/phieu?ro=thieu_ncc',
    })
  return out
}

/** "trễ N ngày" / "hôm nay" / "dd/mm" cho dòng hàng về, hạn xuất lệnh. */
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
