import type { NxtDong } from '@/modules/dept/warehouse/nxt.service'
import { COT_NHAP, COT_XUAT, NHAN_COT, type Cot } from '@/lib/kho-nxt'

/** Số lượng kiểu VN, tối đa 3 lẻ. */
export const fmtSl = (n: number) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })
/** Tiền VND làm tròn đồng. */
export const fmtTien = (n: number) => Math.round(n).toLocaleString('vi-VN')
export const dmy = (iso: string) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

/** `YYYY-MM` → "Tháng 10/2026". */
export const nhanThang = (ym: string) => `Tháng ${ym.slice(5, 7)}/${ym.slice(0, 4)}`

/** Các tháng từ `dau` tới `cuoi` (gồm hai đầu), mới trước. */
export function dsThang(dau: string, cuoi: string): string[] {
  const out: string[] = []
  let [y, m] = cuoi.split('-').map(Number)
  const [y0, m0] = dau.split('-').map(Number)
  while (y > y0 || (y === y0 && m >= m0)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m--
    if (m === 0) {
      m = 12
      y--
    }
    if (out.length > 120) break
  }
  return out
}

/** Một cột số của lưới — header, ô dòng, ô nhóm, ô chân đi theo cùng một khai báo. */
export type CotSo = {
  key: string
  label: string
  /** Chú thích khi rê chuột tiêu đề (mã lý do gộp vào cột). */
  title?: string
  w: number
  /** Thuộc khối Nhập / Xuất (tiêu đề nhóm hai tầng). */
  khoi?: 'n' | 'x'
  /** Vạch ngăn trái. */
  sep?: boolean
  sl?: (r: NxtDong) => number
  tien?: (r: NxtDong) => number | null
  /**
   * Ô tiền ở dòng nhóm / chân: cộng `tien` của các dòng. CHỈ cột tiền riêng
   * (Giá trị tồn cuối) — đặt tiền vào cột Nhập/Xuất là trộn tiền với số lượng
   * trong một cột (soi màn thật 19/10). Tiền nhập/xuất ở tooltip + Excel.
   */
  congTien?: boolean
  donGia?: boolean
}

const MA_COT: Record<Cot, string> = {
  mua: 'N1 nhập theo đơn + N2 mua ngoài đơn',
  hoan: 'N3 hoàn vật tư thừa từ sản xuất',
  kkThua: 'N4 thừa sau kiểm kê',
  nhapKhac: 'Dòng nhập cũ không suy được lý do',
  choLenh: 'X1 cấp cho lệnh + X2 cấp bù hao',
  kkThieu: 'X5 thiếu sau kiểm kê',
  xuatKhac: 'X3 trả NCC · X4 huỷ · X6 dùng chung · X7 khác',
}

/**
 * Bộ cột theo bề rộng khung + chế độ bày (luật màn hẹp của Kho: ẩn cột bậc
 * thấp thay vì cuộn ngang). `chiTietCot` = bày từng cột lý do; không thì chỉ
 * Cộng nhập / Cộng xuất (chi tiết ở tooltip + phần mở dưới dòng).
 */
export function dungCot(o: {
  tien: boolean
  chiTietCot: boolean
  coNhapKhac: boolean
}): CotSo[] {
  const ds: CotSo[] = [
    { key: 'dau', label: 'Tồn đầu', w: 84, sep: true, sl: (r) => r.ton_dau },
  ]
  if (o.chiTietCot) {
    COT_NHAP.filter((c) => c !== 'nhapKhac' || o.coNhapKhac).forEach(
      (c, i) =>
      ds.push({ key: c, label: NHAN_COT[c], title: MA_COT[c], w: c === 'mua' ? 80 : 76, khoi: 'n', sep: i === 0, sl: (r) => r.nhap[c] }), // prettier-ignore
    )
  }
  ds.push({
    key: 'congNhap',
    label: o.chiTietCot ? 'Cộng' : 'Nhập',
    w: 86,
    khoi: 'n',
    sep: !o.chiTietCot,
    sl: (r) => r.cong_nhap,
    tien: (r) => r.gt_nhap,
  })
  if (o.chiTietCot) {
    COT_XUAT.forEach(
      (c, i) =>
      ds.push({ key: c, label: NHAN_COT[c], title: MA_COT[c], w: c === 'choLenh' ? 80 : 76, khoi: 'x', sep: i === 0, sl: (r) => r.xuat[c] }), // prettier-ignore
    )
  }
  ds.push({
    key: 'congXuat',
    label: o.chiTietCot ? 'Cộng' : 'Xuất',
    w: 86,
    khoi: 'x',
    sep: !o.chiTietCot,
    sl: (r) => r.cong_xuat,
    tien: (r) => r.gt_xuat,
  })
  ds.push({ key: 'cuoi', label: 'Tồn cuối', w: 86, sep: true, sl: (r) => r.ton_cuoi })
  if (o.tien) {
    ds.push({ key: 'gia', label: 'Đơn giá BQ', w: 92, donGia: true })
    ds.push({ key: 'gt', label: 'Giá trị tồn cuối', w: 134, tien: (r) => r.gt_cuoi, congTien: true }) // prettier-ignore
  }
  return ds
}

/** Tooltip của ô Cộng nhập / Cộng xuất khi các cột lý do đang ẩn. */
export function tachCot(r: NxtDong, khoi: 'n' | 'x'): string {
  const ds = khoi === 'n' ? COT_NHAP : COT_XUAT
  const src: Record<string, number> = khoi === 'n' ? r.nhap : r.xuat
  return ds
    .filter((c) => Math.abs(src[c]) > 1e-9)
    .map((c) => `${NHAN_COT[c]} ${fmtSl(src[c])}`)
    .join(' · ')
}
