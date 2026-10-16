'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, Empty, Pick } from '@/components/kit'
import { cn } from '@/lib/utils'
import { chuO, dsTo, tinhBangTo, type OTo } from '@/lib/cham-cong/bang-to'
import { gioPhut } from '@/lib/cham-cong/mot-nguoi'
import { useKyCong } from './useKyCong'
import { KhungTrang } from './khung-trang'
import { THU, dm, thu, type KyCong } from './ky-cong.shared'
import { so } from './cham-cong.shared'

/** Màu ô theo kiểu — cùng ký hiệu chú giải đầu bảng. */
const NEN: Record<OTo['kieu'], string> = {
  gio: '',
  mot: 'bg-[var(--warn-wash)] font-semibold text-[var(--warn)]',
  vang: 'bg-[var(--stop-wash)] font-semibold text-[var(--stop)]',
  dangLam: 'text-[var(--act-text)]',
  trong: '',
}

/** Tuần (thứ Hai → Chủ nhật) chứa các ngày của kỳ — cho chế độ "Giờ vào – ra". */
function chiaTuan(ngays: string[]): string[][] {
  const out: string[][] = []
  for (const d of ngays) {
    if (!out.length || thu(d) === 1) out.push([])
    out[out.length - 1].push(d)
  }
  return out
}

/**
 * BẢNG CHẤM CÔNG THEO TỔ (bản vẽ TheoTo.dc.html, duyệt 17/10/2026) — "ngày hôm đó tổ
 * có bao nhiêu người đi làm, từng người đi làm thế nào?". Giống sổ chấm công Excel:
 * mỗi dòng một người, mỗi cột một ngày; dòng đầu là số người đi làm của tổ. Chỉ bày
 * lượt quẹt — ô là tổng thời gian vào → ra, chưa phải công.
 */
export function TheoToScreen({ k, toDau }: { k: KyCong; toDau?: string }) {
  const d = useKyCong(k)
  const router = useRouter()
  const tos = useMemo(() => dsTo(k.du.nhanSu), [k.du.nhanSu])
  const [to, setTo] = useState(
    toDau && tos.some((x) => x.to === toDau) ? toDau : (tos[0]?.to ?? ''),
  )
  const [che, setChe] = useState<'gio' | 'vaora'>('gio')
  const b = useMemo(
    () =>
      tinhBangTo({
        to,
        theoNgay: k.du.theoNgay,
        dong: k.du.dong,
        nhanSu: k.du.nhanSu,
        homNay: k.homNay,
      }),
    [k, to],
  )
  const tuans = useMemo(() => chiaTuan(b.ngays.map((n) => n.ngay)), [b.ngays])
  const [tuan, setTuan] = useState(() => Math.max(0, tuans.length - 1))
  const iTuan = Math.min(tuan, Math.max(0, tuans.length - 1))
  const hien =
    che === 'gio'
      ? b.ngays.map((_, i) => i)
      : b.ngays.flatMap((n, i) => (tuans[iTuan]?.includes(n.ngay) ? [i] : []))

  function doiTo(v: string) {
    setTo(v)
    router.replace(`/hr/cham-cong/theo-to?thang=${k.thang}&to=${encodeURIComponent(v)}`, {
      scroll: false,
    })
  }

  const c = 'border-b border-[var(--line-faint)]/40 px-1.5'
  const h = cn(
    c,
    'border-[var(--line)] bg-[var(--surface-raised)] font-semibold text-[var(--ink-2)]',
  )
  const nguoi = b.nguoi.length

  return (
    <KhungTrang
      ten="Bảng chấm công theo tổ"
      thang={k.thang}
      onThang={(t) =>
        router.push(`/hr/cham-cong/theo-to?thang=${t}&to=${encodeURIComponent(to)}`)
      }
      facts={[{ label: 'Người của tổ', value: so(nguoi) }]}
      actions={
        <>
          <Pick
            label="Tổ"
            value={to}
            onChange={doiTo}
            options={tos.map((x) => ({ value: x.to, label: `${x.to} (${x.so})` }))}
          />
          <div
            role="radiogroup"
            aria-label="Ô bày gì"
            className="inline-flex overflow-hidden border border-[var(--line)]"
          >
            {(
              [
                ['gio', 'Tổng giờ'],
                ['vaora', 'Giờ vào – ra (theo tuần)'],
              ] as const
            ).map(([id, ten], i) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={che === id}
                onClick={() => setChe(id)}
                className={cn(
                  'text-k-sm h-7 px-2.5',
                  i > 0 && 'border-l border-[var(--line)]',
                  che === id
                    ? 'bg-[var(--act)] font-medium text-white'
                    : 'bg-[var(--surface-card)] hover:bg-[var(--surface-hover)]',
                )}
              >
                {ten}
              </button>
            ))}
          </div>
          <Btn
            icon="excel"
            aria-disabled={nguoi === 0}
            onClick={() => {
              if (nguoi)
                window.location.assign(
                  `/api/dept/hr/cham-cong/to/excel?thang=${k.thang}&to=${encodeURIComponent(to)}`,
                )
            }}
          >
            Xuất Excel tổ
          </Btn>
        </>
      }
    >
      <div className="text-k-label flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1 text-[var(--ink-2)]">
        {che === 'gio' ? (
          <span>
            Ô = tổng giờ từ lượt đầu tới lượt cuối (làm tròn xuống) — chưa phải công
          </span>
        ) : (
          <span className="flex flex-wrap items-center gap-1">
            Tuần:
            {tuans.map((w, i) => (
              <button
                key={w[0]}
                type="button"
                aria-pressed={i === iTuan}
                onClick={() => setTuan(i)}
                className={cn(
                  'num h-6 border px-2',
                  i === iTuan
                    ? 'border-[var(--act)] bg-[var(--act-wash)] text-[var(--act-text)]'
                    : 'border-[var(--line)] hover:bg-[var(--surface-hover)]',
                )}
              >
                {dm(w[0])}–{dm(w.at(-1)!)}
              </button>
            ))}
          </span>
        )}
        <span className="num border border-[var(--line)] px-1">14</span> có vào + ra
        <span className="num bg-[var(--warn-wash)] px-1 text-[var(--warn)]">!</span> chỉ 1
        lượt
        <span className="num bg-[var(--stop-wash)] px-1 text-[var(--stop)]">V</span> không
        quẹt
        <span className="num px-1 text-[var(--act-text)]">•</span> hôm nay, mới vào
        <span className="num bg-[var(--chrome)] px-1">CN</span> chủ nhật
      </div>

      {nguoi === 0 ? (
        <div className="flex-1 bg-[var(--surface-card)]">
          <Empty
            headline="Chưa có nhân viên nào cần chấm công"
            reason="Bảng tổ lấy người từ Hồ sơ nhân viên (đang làm, trừ người Không chấm công)."
            next={
              <Btn onClick={() => router.push('/hr/nhan-vien')}>Sang Hồ sơ nhân viên</Btn>
            }
          />
        </div>
      ) : (
        <div
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-[var(--surface-card)]"
          role="region"
          aria-label={`Bảng chấm công ${to}`}
          tabIndex={0}
        >
          <table className="text-k-sm w-full table-fixed border-separate border-spacing-0">
            <colgroup>
              <col style={{ width: 200 }} />
              {hien.map((i) => (
                <col key={b.ngays[i].ngay} />
              ))}
              <col style={{ width: 52 }} />
              <col style={{ width: 48 }} />
              <col style={{ width: 44 }} />
              <col style={{ width: 60 }} />
            </colgroup>
            <thead className="sticky top-0 z-[2]">
              <tr>
                <th className={cn(h, 'text-left')} rowSpan={2}>
                  Mã · Họ tên
                </th>
                {hien.map((i) => {
                  const n = b.ngays[i]
                  return (
                    <th
                      key={n.ngay}
                      className={cn(
                        h,
                        'border-l px-0 text-center text-[11px] leading-3',
                        n.cn && 'bg-[var(--chrome)]',
                        n.homNay && 'text-[var(--act-text)]',
                      )}
                    >
                      {Number(n.ngay.slice(8))}
                      <br />
                      {THU[thu(n.ngay)]}
                    </th>
                  )
                })}
                {['Ngày đi làm', 'Thiếu lượt', 'Vắng', 'Tổng giờ'].map((x, i) => (
                  <th
                    key={x}
                    rowSpan={2}
                    className={cn(h, 'text-[11px] leading-3', i === 0 && 'border-l')}
                    style={{ textAlign: 'right', whiteSpace: 'normal' }}
                    title={i < 3 ? 'Cả tháng, không tính hôm nay' : 'Cả tháng'}
                  >
                    {x}
                  </th>
                ))}
              </tr>
              <tr>
                {hien.map((i) => {
                  const n = b.ngays[i]
                  const thap = !n.cn && !n.homNay && n.daLay && n.diLam / nguoi < 0.85
                  return (
                    <td
                      key={n.ngay}
                      title="Số người của tổ có quẹt trong ngày / người của tổ"
                      className={cn(
                        c,
                        'num border-l border-[var(--line)] bg-[var(--surface-raised)] px-0 text-center text-[11px]',
                        thap && 'bg-[var(--warn-wash)] font-semibold text-[var(--warn)]',
                      )}
                    >
                      {n.daLay ? `${n.diLam}/${nguoi}` : '·'}
                    </td>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {b.nguoi.map((p) => (
                <tr key={p.ma} className="hover:bg-[var(--surface-hover)]">
                  <td className={cn(c, 'truncate py-0.5')} title={`${p.ma} · ${p.ten}`}>
                    <span className="num mr-1.5 text-[var(--ink-3)]">{p.ma}</span>
                    <Link
                      href={`/hr/cham-cong/nguoi/${encodeURIComponent(p.ma)}?thang=${k.thang}`}
                      className="text-[var(--act-text)] hover:underline"
                    >
                      {p.ten}
                    </Link>
                  </td>
                  {hien.map((i) => {
                    const o = p.o[i]
                    const n = b.ngays[i]
                    const tip = `${dm(o.ngay)} ${THU[thu(o.ngay)]}${o.vao ? ` · vào ${o.vao}` : ''}${o.ra ? ` · ra ${o.ra}` : ''}${o.phut != null ? ` · ${gioPhut(o.phut)}` : ''}`
                    return (
                      <td
                        key={o.ngay}
                        title={tip}
                        onClick={() => d.moNguoi(p.ma)}
                        className={cn(
                          c,
                          'num cursor-pointer border-l px-0 text-center',
                          n.cn && 'bg-[var(--chrome)]/60 text-[var(--ink-2)]',
                          NEN[o.kieu],
                        )}
                      >
                        {che === 'gio' ? (
                          chuO(o)
                        ) : o.vao ? (
                          <span className="block py-0.5 text-[11px] leading-[14px]">
                            {o.vao}
                            <br />
                            {o.ra ?? (o.kieu === 'dangLam' ? '…' : '—')}
                          </span>
                        ) : (
                          chuO(o)
                        )}
                      </td>
                    )
                  })}
                  <td
                    className={cn(c, 'num border-l bg-[var(--surface-raised)]')}
                    style={{ textAlign: 'right' }}
                  >
                    {p.diLam}
                  </td>
                  <td
                    className={cn(
                      c,
                      'num bg-[var(--surface-raised)]',
                      p.thieu > 0 && 'text-[var(--warn)]',
                    )}
                    style={{ textAlign: 'right' }}
                  >
                    {p.thieu}
                  </td>
                  <td
                    className={cn(
                      c,
                      'num bg-[var(--surface-raised)]',
                      p.vang > 0 && 'font-semibold text-[var(--stop)]',
                    )}
                    style={{ textAlign: 'right' }}
                  >
                    {p.vang}
                  </td>
                  <td
                    className={cn(c, 'num bg-[var(--surface-raised)]')}
                    style={{ textAlign: 'right' }}
                  >
                    {so(Math.round(p.phut / 60))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-[2]">
              <tr>
                <td
                  className={cn(
                    c,
                    'border-t border-[var(--line)] bg-[var(--surface-raised)] font-semibold',
                  )}
                >
                  Cộng {so(nguoi)} người
                </td>
                {hien.map((i) => {
                  const n = b.ngays[i]
                  return (
                    <td
                      key={n.ngay}
                      className={cn(
                        c,
                        'num border-t border-l border-[var(--line)] bg-[var(--surface-raised)] px-0 text-center font-semibold',
                      )}
                    >
                      {n.daLay ? n.diLam : '·'}
                    </td>
                  )
                })}
                <td
                  className={cn(
                    c,
                    'num border-t border-l border-[var(--line)] bg-[var(--surface-raised)] font-semibold',
                  )}
                  style={{ textAlign: 'right' }}
                >
                  {so(b.tong.diLam)}
                </td>
                <td
                  className={cn(
                    c,
                    'num border-t border-[var(--line)] bg-[var(--surface-raised)] font-semibold text-[var(--warn)]',
                  )}
                  style={{ textAlign: 'right' }}
                >
                  {so(b.tong.thieu)}
                </td>
                <td
                  className={cn(
                    c,
                    'num border-t border-[var(--line)] bg-[var(--surface-raised)] font-semibold text-[var(--stop)]',
                  )}
                  style={{ textAlign: 'right' }}
                >
                  {so(b.tong.vang)}
                </td>
                <td
                  className={cn(
                    c,
                    'num border-t border-[var(--line)] bg-[var(--surface-raised)] font-semibold',
                  )}
                  style={{ textAlign: 'right' }}
                >
                  {so(Math.round(b.tong.phut / 60))}
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="text-k-label px-[var(--gutter)] py-1.5 text-[var(--ink-3)]">
            Bấm tên hoặc một ô → Chấm công một người. Ngày chưa lấy dữ liệu ghi “·”, hôm
            nay chưa tính vắng. Điều chỉnh công (bổ sung lượt, nghỉ có lý do) làm ở bước
            sau.
          </p>
        </div>
      )}
    </KhungTrang>
  )
}
