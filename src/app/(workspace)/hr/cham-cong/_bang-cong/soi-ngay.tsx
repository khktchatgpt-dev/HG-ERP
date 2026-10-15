'use client'

import { Hint, WhyBox } from '@/components/kit'
import type { ChamCongCtx } from './useChamCong'
import { THU, gio, so, thuCua } from '../cham-cong.shared'

const phut = (g: string) => Number(g.slice(0, 2)) * 60 + Number(g.slice(3, 5))
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/**
 * NGĂN SOI một ô ngày: lượt quẹt gốc (máy nào, mấy giờ, lượt lặp đã gộp) và phép
 * tính NGUYÊN VĂN ra con số trong ô (nguyên tắc 6: số không kiểm được thì không ai tin).
 */
export function SoiNgay({ d }: { d: ChamCongCtx }) {
  const n = d.nguoiChon
  const k = d.ngayChon
  if (!n || !k || !d.chon) {
    return (
      <div className="text-k-sm border-t border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-2 text-[var(--ink-2)]">
        Bấm một ô ngày để xem lượt quẹt gốc và phép tính ra con số trong ô.
      </div>
    )
  }
  const ca = d.b.cas.find((c) => c.code === n.ca)!
  const ngay = d.chon.ngay
  const thang = d.b.thang
  const vao = phut(k.luot[0].gio)
  const ra = phut(k.luot[k.luot.length - 1].gio)
  const bd = phut(ca.start)
  const kt = phut(ca.end)

  let lines: string[] = []
  let result = ''
  let viecTiep = 'Không cần xử lý.'
  if (k.kieu === 'thieu') {
    lines = [
      `Ca ${ca.name} bắt ${ca.requiredPunches} lượt; ngày này chỉ có ${k.luot.length === 1 ? '1 lượt' : 'các lượt cách nhau dưới 1 giờ'}.`,
      vao < 720
        ? 'Nhiều khả năng là lượt VÀO — thiếu lượt RA.'
        : 'Nhiều khả năng là lượt RA — thiếu lượt VÀO.',
    ]
    result = 'Chưa tính công ngày này'
    viecTiep = 'Bổ sung lượt thiếu (kèm lý do, Nhân sự duyệt) — làm ở bước sau.'
  } else if (k.kieu === 'ngoai') {
    lines = [
      `Vào ${k.luot[0].gio.slice(0, 5)} — ngoài khung vào của ca ${ca.name} (${hhmm(bd - 120)}–${hhmm(bd + 300)}).`,
      'Có thể là ca đêm hoặc làm thay ca người khác.',
    ]
    result = 'Chưa tính công ngày này'
    viecTiep =
      'Nếu người này thật sự làm ca khác thì đổi ca cho họ; nếu chỉ một ngày thì ghi lý do.'
  } else if (ca.requiredPunches === 1) {
    lines = [
      `Ca ${ca.name} chỉ bắt lượt vào.`,
      `Vào ${k.luot[0].gio.slice(0, 5)}${k.tre ? ` → trễ ${k.tre} phút (sau ${hhmm(bd + ca.graceMin)})` : ' → đúng giờ'}`,
      ...(k.tangCa
        ? [
            `Ra ${k.luot[k.luot.length - 1].gio.slice(0, 5)} → tăng ca từ ${ca.otFrom} = ${gio(k.tangCa)} giờ`,
          ]
        : []),
    ]
    result = `${gio(k.gioCong)} giờ = 1 công${k.tangCa ? ` + ${gio(k.tangCa)} giờ TC` : ''}`
  } else {
    const s = Math.max(vao, bd)
    const e = Math.min(ra, kt)
    const truNghi = e - s > (kt - bd) / 2
    lines = [
      `Vào ${k.luot[0].gio.slice(0, 5)} → tính từ ${hhmm(s)}${k.tre ? ` · trễ ${k.tre} phút` : ''}`,
      `Ra ${k.luot[k.luot.length - 1].gio.slice(0, 5)} → giờ ca tính tới ${hhmm(e)}`,
      `${hhmm(s)}→${hhmm(e)} = ${gio(Math.max(0, e - s))} giờ${truNghi ? ` − nghỉ ${gio(ca.breakMin)} giờ` : ' (chưa quá nửa ca, không trừ nghỉ)'} → ${gio(k.gioCong)} giờ (trần ${gio(kt - bd - ca.breakMin)})`,
      k.tangCa
        ? `TC ${ca.otFrom}→${k.luot[k.luot.length - 1].gio.slice(0, 5)} = ${gio(ra - phut(ca.otFrom))} giờ, làm tròn xuống ${ca.otRound} phút → ${gio(k.tangCa)} giờ`
        : 'Ra trước giờ tăng ca → không có tăng ca',
    ]
    result =
      k.kieu === 'cn'
        ? `${gio(k.gioCong + k.tangCa)} giờ chủ nhật (cột riêng)`
        : k.kieu === 'le'
          ? `${gio(k.gioCong + k.tangCa)} giờ ngày lễ (cột riêng)`
          : `${so(k.gioCong / (kt - bd - ca.breakMin), 2)} công${k.tangCa ? ` + ${gio(k.tangCa)} giờ TC` : ''}`
    if (k.tre) viecTiep = 'Trễ chỉ đếm, không trừ công.'
  }

  return (
    <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] border-t border-[var(--line)] bg-[var(--surface-card)]">
      <section
        className="min-w-0 border-r border-[var(--line)] px-[var(--gutter)] py-2"
        aria-label="Lượt quẹt gốc"
      >
        <div className="text-k-label font-semibold text-[var(--ink-3)]">
          Lượt quẹt gốc · {String(ngay).padStart(2, '0')}/{thang.slice(5)}/
          {thang.slice(0, 4)} ({THU[thuCua(d.b, ngay)]})
        </div>
        <ul className="text-k-sm mt-1">
          {k.luot.map((l, i) => (
            <li key={i} className="flex items-baseline gap-2">
              <b className="num">{l.gio}</b>
              <span>máy {l.may}</span>
              {l.lap > 0 && <Hint>+{l.lap} lượt lặp trong 2 phút, đã gộp</Hint>}
            </li>
          ))}
        </ul>
        <div className="text-k-sm mt-1 text-[var(--ink-2)]">
          {n.code} · {n.ten} · ca {ca.name} {ca.start}–{ca.end}
        </div>
      </section>
      <section
        className="min-w-0 border-r border-[var(--line)] px-[var(--gutter)] py-2"
        aria-label="Phép tính"
      >
        <WhyBox lines={lines} result={result} />
      </section>
      <section
        className="text-k-sm min-w-0 px-[var(--gutter)] py-2"
        aria-label="Việc tiếp"
      >
        <div className="text-k-label font-semibold text-[var(--ink-3)]">Việc tiếp</div>
        <p className="mt-1 text-[var(--ink-2)]">{viecTiep}</p>
      </section>
    </div>
  )
}
