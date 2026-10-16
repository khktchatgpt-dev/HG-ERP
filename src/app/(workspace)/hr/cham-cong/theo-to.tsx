'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, Empty, NoticeBar, Pick } from '@/components/kit'
import { cn } from '@/lib/utils'
import {
  dsTo,
  soCong,
  tcGon,
  tinhBangTo,
  type KyHieu,
  type OTo,
} from '@/lib/cham-cong/bang-to'
import { gioPhut } from '@/lib/cham-cong/mot-nguoi'
import { useKyCong } from './useKyCong'
import { KhungTrang } from './khung-trang'
import { THU, dm, thu, type KyCong } from './ky-cong.shared'
import { so } from './cham-cong.shared'

/** Màu ô theo ký hiệu — cùng chú giải đầu bảng. */
const NEN: Record<KyHieu, string> = {
  X: '',
  '½': 'bg-[var(--warn-wash)] text-[var(--warn)]',
  CN: 'bg-[var(--chrome)] text-[var(--ink)]',
  'CN½': 'bg-[var(--chrome)] text-[var(--warn)]',
  V: 'bg-[var(--stop-wash)] text-[var(--stop)]',
  '?': 'bg-[var(--warn-wash)] text-[var(--warn)] outline outline-1 -outline-offset-[3px] outline-[var(--warn-line)]',
  '•': 'text-[var(--act-text)]',
  '': '',
}

/** Tuần (thứ Hai → Chủ nhật) của kỳ — cho chế độ "Giờ vào – ra". */
function chiaTuan(ngays: string[]): string[][] {
  const out: string[][] = []
  for (const d of ngays) {
    if (!out.length || thu(d) === 1) out.push([])
    out[out.length - 1].push(d)
  }
  return out
}

const goiY = (o: OTo) =>
  [
    `${dm(o.ngay)} ${THU[thu(o.ngay)]}`,
    o.vao && `vào ${o.vao}`,
    o.ra && `ra ${o.ra}`,
    o.phut != null && `tổng ${gioPhut(o.phut)}`,
    o.tc ? `tăng ca ${tcGon(o.tc)} giờ` : null,
    o.lyDo,
  ]
    .filter(Boolean)
    .join(' · ')

/**
 * BẢNG CHẤM CÔNG THEO TỔ v2 (bản vẽ TheoTo.dc.html v2, duyệt 17/10/2026) — theo mẫu
 * bảng chấm công Nhân sự quen dùng: ô ghi CÔNG (X · ½ · CN · V · ?), số nhỏ là giờ
 * tăng ca; cột tổng đúng thứ bảng lương cần. Dòng đầu: người đi làm của tổ mỗi ngày.
 * Lỗi chung cả ngày (hơn nửa tổ cùng thiếu lượt) báo một lần ở dải trên bảng.
 */
export function TheoToScreen({ k, toDau }: { k: KyCong; toDau?: string }) {
  const d = useKyCong(k)
  const router = useRouter()
  const tos = useMemo(() => dsTo(k.du.nhanSu), [k.du.nhanSu])
  const [to, setTo] = useState(
    toDau && tos.some((x) => x.to === toDau) ? toDau : (tos[0]?.to ?? ''),
  )
  const [che, setChe] = useState<'cong' | 'vaora'>('cong')
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
    che === 'cong'
      ? b.ngays.map((_, i) => i)
      : b.ngays.flatMap((n, i) => (tuans[iTuan]?.includes(n.ngay) ? [i] : []))
  const nguoi = b.nguoi.length
  const cacCa = [...new Set(b.nguoi.map((p) => p.ca))]

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
  const s = cn(c, 'num border-l border-[var(--line)] bg-[var(--surface-raised)]')
  const f = cn(
    c,
    'num border-t border-[var(--line)] bg-[var(--surface-raised)] font-semibold',
  )

  return (
    <KhungTrang
      ten="Bảng chấm công"
      thang={k.thang}
      onThang={(t) =>
        router.push(`/hr/cham-cong/theo-to?thang=${t}&to=${encodeURIComponent(to)}`)
      }
      facts={[
        { label: 'Người', value: so(nguoi) },
        { label: 'Ca', value: cacCa.join(', ') || '—' },
      ]}
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
                ['cong', 'Công'],
                ['vaora', 'Giờ vào – ra'],
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
            Xuất Excel
          </Btn>
        </>
      }
    >
      {b.loiNgay.map((x) => (
        <NoticeBar
          key={x.ngay}
          tone="warn"
          tag={`${THU[thu(x.ngay)]} ${dm(x.ngay)}`}
          action={{
            label: 'Xem lượt ngày này',
            onClick: () =>
              router.push(
                `/hr/cham-cong/luot?thang=${k.thang}&ngay=${x.ngay}&bo-phan=${encodeURIComponent(to)}`,
              ),
          }}
        >
          {x.so}/{x.diLam} người đi làm chỉ có 1 lượt hoặc thiếu giờ — có thể máy lỗi hoặc
          cả tổ làm nửa buổi. Điều chỉnh cả tổ một lần sẽ có ở bước Điều chỉnh.
        </NoticeBar>
      ))}

      <div className="text-k-label flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1 text-[var(--ink-2)]">
        {che === 'vaora' && (
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
        <span>
          <b className="num border border-[var(--line)] px-1">X</b> đủ công
        </span>
        <span>
          <b className={cn('num px-1', NEN['½'])}>½</b> nửa công
        </span>
        <span>
          <b className="num border border-[var(--line)] px-1">
            X<sup className="text-[9px] font-normal text-[var(--done)]">5</sup>
          </b>{' '}
          + giờ tăng ca
        </span>
        <span>
          <b className={cn('num px-1', NEN.CN)}>CN</b> công chủ nhật
        </span>
        <span>
          <b className={cn('num px-1', NEN.V)}>V</b> vắng
        </span>
        <span>
          <b className="num bg-[var(--warn-wash)] px-1 text-[var(--warn)]">?</b> thiếu
          lượt — cần xử lý
        </span>
        <span>
          <b className="num px-1 text-[var(--act-text)]">•</b> hôm nay, chưa tính
        </span>
        <span className="ml-auto">
          Đủ công khi làm ≥ giờ chuẩn − 30 phút trong ca; ½ khi ≥ 3,5 giờ
        </span>
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
              <col style={{ width: 196 }} />
              {hien.map((i) => (
                <col key={b.ngays[i].ngay} />
              ))}
              <col style={{ width: 44 }} />
              <col style={{ width: 40 }} />
              <col style={{ width: 46 }} />
              <col style={{ width: 46 }} />
              <col style={{ width: 38 }} />
              <col style={{ width: 46 }} />
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
                {['Công', 'Công CN', 'Giờ TC', 'Nghỉ có lý do', 'Vắng', 'Cần xử lý'].map(
                  (x, i) => (
                    <th
                      key={x}
                      rowSpan={2}
                      className={cn(h, 'text-[11px] leading-3', i === 0 && 'border-l')}
                      style={{ textAlign: 'right', whiteSpace: 'normal' }}
                    >
                      {x}
                    </th>
                  ),
                )}
              </tr>
              <tr>
                {hien.map((i) => {
                  const n = b.ngays[i]
                  const thap =
                    !n.cn &&
                    !n.homNay &&
                    n.daLay &&
                    (n.diLam / nguoi < 0.85 || n.canXuLy * 2 > n.diLam)
                  return (
                    <td
                      key={n.ngay}
                      title="Người của tổ có quẹt trong ngày / người của tổ"
                      className={cn(
                        c,
                        'num border-l border-[var(--line)] bg-[var(--surface-raised)] px-0 text-center text-[10px]',
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
                <tr
                  key={p.ma}
                  className={cn(
                    'hover:bg-[var(--surface-hover)]',
                    p.khongQuet && 'text-[var(--ink-3)]',
                  )}
                >
                  <td
                    className={cn(c, 'truncate py-0.5')}
                    title={`${p.ma} · ${p.ten} · ca ${p.ca}`}
                  >
                    <span className="num mr-1.5 text-[var(--ink-3)]">{p.ma}</span>
                    <Link
                      href={`/hr/cham-cong/nguoi/${encodeURIComponent(p.ma)}?thang=${k.thang}`}
                      className="text-[var(--act-text)] hover:underline"
                    >
                      {p.ten}
                    </Link>
                    {p.khongQuet && (
                      <span className="ml-1.5 border border-[var(--stop-line)] bg-[var(--stop-wash)] px-1 text-[10px] text-[var(--stop)]">
                        cả tháng không quẹt — đã nghỉ?
                      </span>
                    )}
                  </td>
                  {hien.map((i) => {
                    const o = p.o[i]
                    const n = b.ngays[i]
                    return (
                      <td
                        key={o.ngay}
                        title={goiY(o)}
                        onClick={() => d.moNguoi(p.ma)}
                        className={cn(
                          c,
                          'num cursor-pointer border-l px-0 text-center font-semibold',
                          n.cn && !o.ky && 'bg-[var(--chrome)]/60',
                          NEN[o.ky],
                        )}
                      >
                        {che === 'vaora' && o.vao ? (
                          <span className="block py-0.5 text-[11px] leading-[14px] font-normal">
                            {o.vao}
                            <br />
                            {o.ra ?? (o.ky === '•' ? '…' : '—')}
                          </span>
                        ) : (
                          <>
                            {o.ky}
                            {o.tc > 0 && (
                              <sup className="ml-px text-[9px] font-normal text-[var(--done)]">
                                {tcGon(o.tc)}
                              </sup>
                            )}
                          </>
                        )}
                      </td>
                    )
                  })}
                  <td className={cn(s, 'font-semibold')} style={{ textAlign: 'right' }}>
                    {soCong(p.cong)}
                  </td>
                  <td className={s} style={{ textAlign: 'right' }}>
                    {soCong(p.congCN)}
                  </td>
                  <td
                    className={cn(s, 'text-[var(--done)]')}
                    style={{ textAlign: 'right' }}
                  >
                    {soCong(p.tc / 60)}
                  </td>
                  <td className={s} style={{ textAlign: 'right' }}>
                    {p.nghi}
                  </td>
                  <td
                    className={cn(s, p.vang > 0 && 'font-semibold text-[var(--stop)]')}
                    style={{ textAlign: 'right' }}
                  >
                    {p.vang}
                  </td>
                  <td
                    className={cn(s, p.canXuLy > 0 && 'font-semibold text-[var(--warn)]')}
                    style={{ textAlign: 'right' }}
                  >
                    {p.canXuLy}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-[2]">
              <tr>
                <td className={cn(f, 'font-sans')}>Cộng {so(nguoi)} người</td>
                {hien.map((i) => {
                  const n = b.ngays[i]
                  return (
                    <td
                      key={n.ngay}
                      title="Tổng công của tổ ngày này"
                      className={cn(f, 'border-l px-0 text-center text-[11px]')}
                    >
                      {n.daLay && !n.homNay ? soCong(n.cong) : '·'}
                    </td>
                  )
                })}
                <td className={cn(f, 'border-l')} style={{ textAlign: 'right' }}>
                  {soCong(b.tong.cong)}
                </td>
                <td className={f} style={{ textAlign: 'right' }}>
                  {soCong(b.tong.congCN)}
                </td>
                <td
                  className={cn(f, 'text-[var(--done)]')}
                  style={{ textAlign: 'right' }}
                >
                  {soCong(b.tong.tc / 60)}
                </td>
                <td className={f} style={{ textAlign: 'right' }}>
                  {b.tong.nghi}
                </td>
                <td
                  className={cn(f, 'text-[var(--stop)]')}
                  style={{ textAlign: 'right' }}
                >
                  {b.tong.vang}
                </td>
                <td
                  className={cn(f, 'text-[var(--warn)]')}
                  style={{ textAlign: 'right' }}
                >
                  {b.tong.canXuLy}
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="text-k-label px-[var(--gutter)] py-1.5 text-[var(--ink-3)]">
            Công tính theo luật đã chốt 12/10: trong ca trừ nghỉ trưa, tăng ca từ giờ tan
            ca làm tròn xuống 30 phút. Hôm nay chưa tính; ngày chưa lấy dữ liệu ghi “·”.
            Bấm tên hoặc ô → Chấm công một người. Nghỉ có lý do và điều chỉnh làm ở bước
            Điều chỉnh.
          </p>
        </div>
      )}
    </KhungTrang>
  )
}
