/**
 * KHOẢNG KỲ CÔNG — Nhân sự tự đặt từ–đến cho TỪNG kỳ (bản vẽ duyệt 21/10/2026, Q1–Q5 theo đề
 * xuất). Hàm thuần, chạy được cả trên trình duyệt.
 *
 * Kỳ đã đặt (có dòng hr_time_periods) dùng đúng khoảng đó. Kỳ chưa đặt là GỢI Ý: nối tiếp
 * kỳ liền trước đã đặt (ngày cuối + 1), kết thúc trước kỳ liền sau đã đặt; không có hai
 * bên thì theo mặc định 26 → 25 (`kyCuaThang`). Sổ T9/2026 của Nhân sự là 25/08 → 25/09.
 * Mỗi ngày chỉ thuộc một kỳ: chồng ngày là LỖI, hở ngày chỉ CẢNH BÁO.
 */

import { congNgay, kyCuaThang, thangCuaNgay } from './ky-gio-cong'

export type KhoangDat = { thang: string; tu: string; den: string }
export type KhoangKy = KhoangDat & {
  /** true = Nhân sự đã đặt (hoặc kỳ đã có dòng lúc chốt); false = gợi ý. */
  daDat: boolean
}

/** Số ngày tối thiểu / tối đa của một kỳ (Q4) — ngoài khoảng này gần như chắc gõ nhầm. */
export const NGAY_KY_MIN = 28
export const NGAY_KY_MAX = 35

export const doiThang = (thang: string, n: number) => {
  const [y, m] = thang.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}

export const soNgay = (tu: string, den: string) =>
  Math.round(
    (Date.parse(`${den}T00:00:00Z`) - Date.parse(`${tu}T00:00:00Z`)) / 86_400_000,
  ) + 1

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const tenKy = (thang: string) => `${thang.slice(5)}/${thang.slice(0, 4)}`

/** Khoảng kỳ của tháng 'YYYY-MM': đã đặt, hoặc gợi ý nối tiếp hai kỳ bên cạnh. */
export function khoangKy(thang: string, ds: readonly KhoangDat[]): KhoangKy {
  const dat = ds.find((d) => d.thang === thang)
  if (dat) return { thang, tu: dat.tu, den: dat.den, daDat: true }
  const mac = kyCuaThang(thang)
  const truoc = ds.find((d) => d.thang === doiThang(thang, -1))
  const sau = ds.find((d) => d.thang === doiThang(thang, 1))
  return {
    thang,
    tu: truoc ? congNgay(truoc.den, 1) : mac.tu,
    den: sau ? congNgay(sau.tu, -1) : mac.den,
    daDat: false,
  }
}

/** Ngày 'YYYY-MM-DD' thuộc kỳ tháng nào, theo khoảng đã đặt / gợi ý. */
export function thangCua(iso: string, ds: readonly KhoangDat[]): string {
  const dat = ds.find((d) => iso >= d.tu && iso <= d.den)
  if (dat) return dat.thang
  const t = thangCuaNgay(iso)
  for (const c of [t, doiThang(t, -1), doiThang(t, 1)]) {
    const k = khoangKy(c, ds)
    if (iso >= k.tu && iso <= k.den) return c
  }
  return t
}

export type KiemKhoang = {
  loi: string[]
  canhBao: string[]
  /** Khoảng gợi ý (nối tiếp kỳ bên cạnh) — khác gợi ý thì bắt lý do. */
  goiY: KhoangDat
  khacGoiY: boolean
}

/** Kiểm khoảng mới của kỳ `thang` trước khi lưu. `ds` = mọi kỳ đã đặt (kể cả kỳ này). */
export function kiemKhoang(
  thang: string,
  tu: string,
  den: string,
  ds: readonly KhoangDat[],
): KiemKhoang {
  const khac = ds.filter((d) => d.thang !== thang)
  const g = khoangKy(thang, khac)
  const goiY = { thang, tu: g.tu, den: g.den }
  const loi: string[] = []
  const canhBao: string[] = []
  const iso = /^\d{4}-\d{2}-\d{2}$/
  if (!iso.test(tu) || !iso.test(den)) loi.push('Ngày không hợp lệ')
  else if (den < tu) loi.push('"Đến ngày" phải sau "Từ ngày"')
  else {
    const n = soNgay(tu, den)
    if (n < NGAY_KY_MIN || n > NGAY_KY_MAX)
      loi.push(
        `Kỳ ${n} ngày — chỉ nhận ${NGAY_KY_MIN}–${NGAY_KY_MAX} ngày (gõ nhầm tháng?)`,
      )
    for (const d of khac) {
      const a = tu > d.tu ? tu : d.tu
      const b = den < d.den ? den : d.den
      if (a <= b) loi.push(`Chồng ${dm(a)} → ${dm(b)} với kỳ ${tenKy(d.thang)}`)
    }
    const truoc = khac.find((d) => d.thang === doiThang(thang, -1))
    if (truoc && congNgay(truoc.den, 1) < tu)
      canhBao.push(
        `Ngày ${dm(congNgay(truoc.den, 1))} → ${dm(congNgay(tu, -1))} không thuộc kỳ nào (kỳ ${tenKy(truoc.thang)} đến ${dm(truoc.den)})`,
      )
    const sau = khac.find((d) => d.thang === doiThang(thang, 1))
    if (sau && congNgay(den, 1) < sau.tu)
      canhBao.push(
        `Ngày ${dm(congNgay(den, 1))} → ${dm(congNgay(sau.tu, -1))} không thuộc kỳ nào (kỳ ${tenKy(sau.thang)} từ ${dm(sau.tu)})`,
      )
  }
  return { loi, canhBao, goiY, khacGoiY: tu !== goiY.tu || den !== goiY.den }
}
