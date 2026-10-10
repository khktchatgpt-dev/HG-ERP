import { fmtMoney, poLineAmount } from '@/lib/po-line'
import { tienTheoLenh } from '@/lib/po-lsx-split'
import type { PoPrintLine } from './PoPrintSheet'

/**
 * PHIẾU IN ĐƠN GỘP LỆNH (10/10/2026, bản vẽ Chia lệnh E, Q7–Q8 theo đề xuất).
 *
 * `PhanTheoLenhIn` — khối nhỏ "Phân theo lệnh sản xuất" ngay dưới dòng Tổng thanh
 * toán: Lệnh · Số dòng · Tiền hàng (chưa VAT). Cùng hàm `tienTheoLenh` với chân
 * mục Chia lệnh trên màn và màn ký — một nguồn số. NCC giao, dán nhãn, xuất hoá
 * đơn tách theo lệnh được. Dòng chưa chia cộng cho lệnh chính (quy ước 0185) và
 * nói ra bằng một câu.
 *
 * `CanhBaoChuaChia` — dải vàng CHỈ TRÊN MÀN (print:hidden): đơn còn dòng chưa chia
 * vẫn in được (có khi phải gửi gấp), nhưng người bấm In phải biết phiếu đang ghi
 * trọn dòng đó cho lệnh chính.
 */
type Lsx = { id: string; code: string }

function tinh(lines: PoPrintLine[], lsxSet: Lsx[]) {
  return tienTheoLenh(
    lines.map((l) => ({
      qty_ordered: l.qty_ordered,
      amount: l.unit_price != null ? poLineAmount(l) : null,
      lsx_split: l.lsx_split ?? null,
    })),
    lsxSet,
  )
}

export function PhanTheoLenhIn({
  lines,
  lsxSet,
  currency,
}: {
  lines: PoPrintLine[]
  lsxSet: Lsx[]
  currency: string
}) {
  if (lsxSet.length < 2) return null
  const t = tinh(lines, lsxSet)
  const tong = t.lenh.reduce((s, x) => s + x.tien, 0) + t.chuaChia.tien
  return (
    <div className="mt-2 max-w-[480px] text-[12px]">
      <div className="font-bold">PHÂN THEO LỆNH SẢN XUẤT</div>
      <table className="mt-0.5 w-full border-collapse">
        <thead>
          <tr>
            <td className="border border-black px-1.5 py-0.5 font-bold">Lệnh</td>
            <td className="border border-black px-1.5 py-0.5 text-center font-bold">
              Số dòng
            </td>
            <td className="border border-black px-1.5 py-0.5 text-center font-bold">
              Tiền hàng ({currency}, chưa VAT)
            </td>
          </tr>
        </thead>
        <tbody>
          {t.lenh.map((x, k) => (
            <tr key={x.id}>
              <td className="border border-black px-1.5 py-0.5">{x.code}</td>
              <td className="border border-black px-1.5 py-0.5 text-right tabular-nums">
                {x.dong + (k === 0 ? t.chuaChia.dong : 0)}
              </td>
              <td className="border border-black px-1.5 py-0.5 text-right tabular-nums">
                {fmtMoney(x.tien + (k === 0 ? t.chuaChia.tien : 0), currency)}
              </td>
            </tr>
          ))}
          <tr>
            <td className="border border-black px-1.5 py-0.5 font-bold">Cộng</td>
            <td className="border border-black px-1.5 py-0.5" />
            <td className="border border-black px-1.5 py-0.5 text-right font-bold tabular-nums">
              {fmtMoney(tong, currency)}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="mt-0.5 text-[11px]">
        Dòng ghi nhiều lệnh được đếm ở mỗi lệnh; tiền chia theo số lượng.
        {t.chuaChia.dong > 0
          ? ` ${t.chuaChia.dong} dòng chưa chia nên đang tính cho lệnh chính ${lsxSet[0].code}.`
          : ''}
      </div>
    </div>
  )
}

export function CanhBaoChuaChia({
  lines,
  lsxSet,
}: {
  lines: PoPrintLine[]
  lsxSet: Lsx[]
}) {
  if (lsxSet.length < 2) return null
  const n = tinh(lines, lsxSet).chuaChia.dong
  if (n === 0) return null
  return (
    <p className="mb-2 bg-amber-50 px-3 py-1.5 text-[12px] text-amber-900 print:hidden">
      Màn in · không in ra giấy — <b>{n} dòng chưa chia lệnh</b>: phiếu đang ghi trọn{' '}
      {n > 1 ? 'các dòng đó' : 'dòng đó'} cho <b>{lsxSet[0].code}</b>. Chia ở mục{' '}
      <b>Chia lệnh</b> của đơn trước khi gửi NCC.
    </p>
  )
}
