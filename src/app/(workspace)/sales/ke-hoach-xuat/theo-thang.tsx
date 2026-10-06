'use client'

import { useMemo } from 'react'
import {
  cong,
  maTran,
  tenThang,
  thangCua,
  type DotXuat,
  type O,
} from '@/lib/ke-hoach-xuat'
import { NUM, Panel, TD, TH } from '../_erp/ui'

const usd = (v: number) => Math.round(v).toLocaleString('vi-VN')

/**
 * TỔNG THEO THÁNG — bảng chéo khách × tháng (USD · số đợt) để nhìn cả năm một
 * mắt. Ghim cột Khách + Cả kế hoạch khi cuộn ngang; tiêu đề hai tầng quý → tháng.
 * Bấm một ô → sang "Theo lệnh" lọc đúng khách đó.
 */
export function TheoThang({
  dots,
  thangs,
  thangNay,
  onCell,
}: {
  dots: DotXuat[]
  thangs: string[]
  thangNay: string
  onCell: (khach: string) => void
}) {
  const mt = useMemo(() => maTran(dots), [dots])
  const tong = cong(dots)
  const theoThang = (ym: string) =>
    cong(dots.filter((d) => d.ship_date && thangCua(d.ship_date) === ym))
  const quy = useMemo(() => {
    const by = new Map<string, string[]>()
    for (const m of thangs) {
      const q = `Q${Math.ceil(Number(m.slice(5, 7)) / 3)}/${m.slice(0, 4)}`
      by.set(q, [...(by.get(q) ?? []), m])
    }
    return [...by.entries()]
  }, [thangs])

  /** Ô: trị giá + số đợt; * khi có đợt mượn ngày của lệnh. */
  const o = (v: O | undefined, qua: boolean) =>
    v && v.n > 0 ? (
      <span className={qua ? 'opacity-50' : undefined}>
        <span className="font-semibold">{usd(v.value)}</span>
        <span className="text-muted-foreground ml-1 text-xs">·{v.n}</span>
        {v.muon > 0 && (
          <span
            className="ml-0.5 font-bold text-[var(--warn)]"
            title={`${v.muon} đợt chưa có ngày xuất riêng — đang mượn ngày xuất cuối của lệnh`}
          >
            *
          </span>
        )}
      </span>
    ) : (
      ''
    )

  return (
    <Panel
      label="Trị giá xuất theo khách và tháng"
      title="Tổng theo tháng · khách × tháng"
      note="USD · ·n = số đợt · bấm ô để xem các lệnh của khách · tháng đã qua in nhạt"
    >
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className={`${TH} sticky left-0 z-20 min-w-[170px] border-r`}
              >
                Khách
              </th>
              <th
                rowSpan={2}
                className={`${TH} sticky left-[170px] z-20 min-w-[130px] border-r text-right`}
              >
                Cả kế hoạch
              </th>
              {quy.map(([q, ms]) => (
                <th key={q} colSpan={ms.length} className={`${TH} border-r text-center`}>
                  {q}
                </th>
              ))}
            </tr>
            <tr>
              {thangs.map((m) => (
                <th
                  key={m}
                  className={`${TH} min-w-[104px] border-r text-right ${m === thangNay ? 'text-[var(--primary)]' : ''}`}
                >
                  {tenThang(m)}
                  {m === thangNay && ' ·nay'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mt.map((r) => (
              <tr key={r.customer} className="group">
                <td
                  className={`${TD} bg-card group-hover:bg-muted sticky left-0 z-10 border-r font-medium whitespace-nowrap`}
                >
                  {r.customer}
                </td>
                <td
                  className={`${TD} ${NUM} bg-card group-hover:bg-muted sticky left-[170px] z-10 border-r`}
                >
                  {o(r.tong, false)}
                </td>
                {thangs.map((m) => {
                  const v = r.theoThang[m]
                  return (
                    <td key={m} className={`${TD} ${NUM} border-r p-0`}>
                      {v && v.n > 0 ? (
                        <button
                          type="button"
                          onClick={() => onCell(r.customer)}
                          className="h-full w-full px-3 text-right hover:bg-[var(--accent)]"
                          title={`${r.customer} · ${tenThang(m)} — xem các lệnh của khách`}
                        >
                          {o(v, m < thangNay)}
                        </button>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="border-border bg-muted sticky left-0 z-10 h-8 border-r px-3 text-xs">
                Cộng theo tháng
              </td>
              <td
                className={`border-border bg-muted sticky left-[170px] z-10 h-8 border-r px-3 ${NUM} text-[13px]`}
              >
                {o(tong, false)}
              </td>
              {thangs.map((m) => (
                <td
                  key={m}
                  className={`border-border bg-muted h-8 border-r px-3 ${NUM} text-[13px]`}
                >
                  {o(theoThang(m), m < thangNay)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="border-border text-muted-foreground border-t px-3 py-2 text-xs">
        Trị giá theo đơn bán (USD): đợt gắn đơn lấy tổng đơn; đợt không gắn đơn = SL dòng
        lệnh × đơn giá cùng SP trong đơn của lệnh — cộng theo lệnh khớp tổng đơn bán.{' '}
        <b className="text-[var(--warn)]">*</b> = có đợt chưa ghi ngày xuất riêng, đang
        mượn ngày cuối của lệnh.
      </p>
    </Panel>
  )
}
