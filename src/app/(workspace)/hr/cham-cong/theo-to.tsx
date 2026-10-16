'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, Empty, NoticeBar, Pick } from '@/components/kit'
import { cn } from '@/lib/utils'
import { dsTo, soCong, tcGon, tinhBangTo, type OTo } from '@/lib/cham-cong/bang-to'
import { gioPhut } from '@/lib/cham-cong/mot-nguoi'
import { useKyCong } from './useKyCong'
import { KhungTrang } from './khung-trang'
import { THU, dm, thu, type KyCong } from './ky-cong.shared'
import { so } from './cham-cong.shared'

/** Cột tên ghim trái. */
const W_TEN = 196
/** Cột tổng ghim phải: [nhãn, bề rộng, gợi ý]. */
const TONG = [
  ['Ngày đi làm', 50, 'Số ngày có quẹt (không tính hôm nay)'],
  ['Công', 46, 'Công ngày thường + công chủ nhật'],
  ['Giờ làm', 54, 'Giờ làm trong ca (trừ nghỉ trưa) + tăng ca'],
  ['Tăng ca', 52, 'Giờ tăng ca, từ giờ tan ca, làm tròn xuống 30 phút'],
  ['Vắng', 40, 'Ngày thường không quẹt'],
  ['Lỗi chấm công', 52, 'Đi làm nhưng thiếu lượt / thiếu giờ — cần xử lý'],
] as const
const W_TONG = TONG.reduce((s, x) => s + x[1], 0)
/** Bề phải (px) của cột tổng thứ i khi ghim phải. */
const phai = (i: number) => TONG.slice(i + 1).reduce((s, x) => s + x[1], 0)
/** Số ngày thấy cùng lúc; nhiều hơn thì kéo ngang. */
const NGAY_THAY = 7

/** Ô chỉ nói có đi làm hay không; lỗi tô cam, chi tiết ở gợi ý + trang một người. */
function O({ o }: { o: OTo }) {
  if (o.ky === 'V') return <span className="font-semibold text-[var(--stop)]">V</span>
  if (o.ky === '•') return <span className="text-[var(--act-text)]">•</span>
  if (!o.ky) return null
  const loi = o.ky === '?'
  return (
    <span
      className={cn('font-semibold', loi ? 'text-[var(--warn)]' : 'text-[var(--done)]')}
    >
      ✓
    </span>
  )
}

const goiY = (o: OTo) =>
  [
    `${dm(o.ngay)} ${THU[thu(o.ngay)]}`,
    o.ky === 'V' && 'không quẹt',
    o.vao && `vào ${o.vao}`,
    o.ra && `ra ${o.ra}`,
    o.phut != null && `tổng ${gioPhut(o.phut)}`,
    o.tc ? `tăng ca ${tcGon(o.tc)} giờ` : null,
    o.ky === '½' && 'nửa công',
    o.lyDo && `LỖI: ${o.lyDo}`,
  ]
    .filter(Boolean)
    .join(' · ')

/**
 * BẢNG CHẤM CÔNG THEO TỔ (chủ dự án 17/10/2026 sau bản v2: "chỉ hiển thị ngày đó có
 * đi làm hay không, lỗi để phía sau; đủ cột cho 7 ngày, muốn coi thêm thì kéo sang;
 * bên phải là tổng giờ làm, vắng…"). Tên ghim trái, cột tổng ghim phải, giữa là các
 * ngày — 7 ngày một khung, cuộn ngang. Mở trang là đang thấy 7 ngày gần nhất.
 */
export function TheoToScreen({ k, toDau }: { k: KyCong; toDau?: string }) {
  const d = useKyCong(k)
  const router = useRouter()
  const tos = useMemo(() => dsTo(k.du.nhanSu), [k.du.nhanSu])
  const [to, setTo] = useState(
    toDau && tos.some((x) => x.to === toDau) ? toDau : (tos[0]?.to ?? ''),
  )
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
  const nguoi = b.nguoi.length

  // Bề rộng một cột ngày = (khung − tên − tổng) / 7, tối thiểu 44px.
  const khung = useRef<HTMLDivElement>(null)
  const [wNgay, setWNgay] = useState(64)
  useEffect(() => {
    const el = khung.current
    if (!el) return
    const ro = new ResizeObserver(() =>
      setWNgay(Math.max(44, Math.floor((el.clientWidth - W_TEN - W_TONG) / NGAY_THAY))),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [nguoi])
  // Mở trang / đổi tổ → cuộn tới các ngày gần nhất.
  useEffect(() => {
    const el = khung.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [to, wNgay, nguoi])

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
  const ghimTrai = 'sticky left-0 z-[1] border-r-2 border-r-[var(--line)]'
  const nhom =
    'border-b border-[var(--line)] bg-[var(--surface-raised)] px-2 py-0.5 text-left text-[11px] font-semibold tracking-wide text-[var(--ink-3)] uppercase'
  const tong = (i: number) =>
    cn(
      'sticky z-[1] bg-[var(--chrome)] num',
      i === 0 && 'border-l-2 border-l-[var(--line)]',
    )
  const giaTri = [
    (p: (typeof b.nguoi)[number]) => so(p.diLam),
    (p: (typeof b.nguoi)[number]) => soCong(p.cong + p.congCN),
    (p: (typeof b.nguoi)[number]) => soCong(p.gioLam / 60),
    (p: (typeof b.nguoi)[number]) => soCong(p.tc / 60),
    (p: (typeof b.nguoi)[number]) => so(p.vang),
    (p: (typeof b.nguoi)[number]) => so(p.canXuLy),
  ]
  const tongTo = [
    so(b.tong.diLam),
    soCong(b.tong.cong + b.tong.congCN),
    soCong(b.tong.gioLam / 60),
    soCong(b.tong.tc / 60),
    so(b.tong.vang),
    so(b.tong.canXuLy),
  ]
  const mauTong = (i: number, v: number) =>
    i === 4 && v > 0
      ? 'font-semibold text-[var(--stop)]'
      : i === 5 && v > 0
        ? 'font-semibold text-[var(--warn)]'
        : i === 3
          ? 'text-[var(--done)]'
          : ''

  return (
    <KhungTrang
      ten="Bảng chấm công"
      thang={k.thang}
      onThang={(t) =>
        router.push(`/hr/cham-cong/theo-to?thang=${t}&to=${encodeURIComponent(to)}`)
      }
      facts={[
        { label: 'Người', value: so(nguoi) },
        { label: 'Ca', value: [...new Set(b.nguoi.map((p) => p.ca))].join(', ') || '—' },
      ]}
      actions={
        <>
          <Pick
            label="Tổ"
            value={to}
            onChange={doiTo}
            options={tos.map((x) => ({ value: x.to, label: `${x.to} (${x.so})` }))}
          />
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
          {x.so}/{x.diLam} người đi làm bị lỗi chấm công (chỉ 1 lượt / thiếu giờ) — có thể
          máy lỗi hoặc cả tổ làm nửa buổi.
        </NoticeBar>
      ))}

      <div className="text-k-label flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1 text-[var(--ink-2)]">
        <span>
          <b className="text-[var(--done)]">✓</b> đi làm
        </span>
        <span>
          <b className="text-[var(--warn)]">✓</b> đi làm, chấm công lỗi
        </span>
        <span>
          <b className="text-[var(--stop)]">V</b> vắng
        </span>
        <span>
          <b className="text-[var(--act-text)]">•</b> hôm nay, đã vào
        </span>
        <span>ô trống: chủ nhật nghỉ / chưa lấy dữ liệu</span>
        <span className="ml-auto">
          Rê chuột lên ô xem giờ vào–ra, lỗi · bấm ô hoặc tên → chấm công của người đó
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
          ref={khung}
          className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]"
          role="region"
          aria-label={`Bảng chấm công ${to}`}
          tabIndex={0}
        >
          <table
            className="text-k-sm table-fixed border-separate border-spacing-0"
            style={{ width: W_TEN + b.ngays.length * wNgay + W_TONG }}
          >
            <colgroup>
              <col style={{ width: W_TEN }} />
              {b.ngays.map((n) => (
                <col key={n.ngay} style={{ width: wNgay }} />
              ))}
              {TONG.map((x) => (
                <col key={x[0]} style={{ width: x[1] }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-[3]">
              <tr>
                <th
                  className={cn(h, ghimTrai, 'border-r-2 text-left align-bottom')}
                  rowSpan={2}
                  style={{ zIndex: 7 }}
                >
                  Mã · Họ tên
                </th>
                <th colSpan={b.ngays.length} className={cn(nhom, 'text-left')}>
                  <span className="sticky" style={{ left: W_TEN + 8 }}>
                    Từng ngày · ← kéo ngang xem ngày trước
                  </span>
                </th>
                <th
                  colSpan={TONG.length}
                  className={cn(
                    nhom,
                    'sticky border-l-2 border-[var(--line)] bg-[var(--chrome)] text-center',
                  )}
                  style={{ right: 0, zIndex: 7 }}
                >
                  Cộng tháng {k.thang.slice(5)}
                </th>
              </tr>
              <tr>
                {b.ngays.map((n) => (
                  <th
                    key={n.ngay}
                    className={cn(
                      h,
                      'border-l px-0 text-center text-[12px] leading-4',
                      n.cn && 'bg-[var(--chrome)]',
                      n.homNay && 'text-[var(--act-text)]',
                    )}
                  >
                    {Number(n.ngay.slice(8))}/{n.ngay.slice(5, 7)}
                    <span className="block text-[11px] font-normal">
                      {n.homNay ? 'hôm nay' : THU[thu(n.ngay)]}
                    </span>
                  </th>
                ))}
                {TONG.map((x, i) => (
                  <th
                    key={x[0]}
                    title={x[2]}
                    className={cn(h, tong(i), 'text-[11px] leading-3')}
                    style={{
                      right: phai(i),
                      textAlign: 'right',
                      whiteSpace: 'normal',
                      zIndex: 7,
                    }}
                  >
                    {x[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.nguoi.map((p) => (
                <tr
                  key={p.ma}
                  className={cn('group', p.khongQuet && 'text-[var(--ink-3)]')}
                >
                  <td
                    className={cn(
                      c,
                      ghimTrai,
                      'truncate bg-[var(--surface-card)] py-1 group-hover:bg-[var(--surface-hover)]',
                    )}
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
                  {p.o.map((o, i) => {
                    const n = b.ngays[i]
                    return (
                      <td
                        key={o.ngay}
                        title={goiY(o)}
                        onClick={() => d.moNguoi(p.ma)}
                        className={cn(
                          c,
                          'cursor-pointer border-l px-0 text-center group-hover:bg-[var(--surface-hover)]',
                          n.cn && 'bg-[var(--chrome)]/50',
                          o.ky === 'V' && 'bg-[var(--stop-wash)]',
                          o.ky === '?' && 'bg-[var(--warn-wash)]',
                        )}
                      >
                        <O o={o} />
                      </td>
                    )
                  })}
                  {giaTri.map((g, i) => {
                    const v = [p.diLam, 0, 0, p.tc, p.vang, p.canXuLy][i]
                    return (
                      <td
                        key={TONG[i][0]}
                        className={cn(
                          c,
                          tong(i),
                          i === 1 && 'font-semibold',
                          mauTong(i, v),
                        )}
                        style={{ right: phai(i), textAlign: 'right' }}
                      >
                        {g(p)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-[3]">
              <tr>
                <td
                  className={cn(
                    c,
                    ghimTrai,
                    'z-[4] border-t border-[var(--line)] bg-[var(--surface-raised)] font-semibold',
                  )}
                  style={{ zIndex: 7 }}
                >
                  Số người đi làm
                  <span className="block text-[11px] font-normal text-[var(--ink-3)]">
                    trên {so(nguoi)} người của tổ
                  </span>
                </td>
                {b.ngays.map((n) => {
                  const thap = !n.cn && !n.homNay && n.daLay && n.diLam / nguoi < 0.85
                  return (
                    <td
                      key={n.ngay}
                      title={
                        thap
                          ? 'Dưới 85% người của tổ đi làm'
                          : 'Người của tổ đi làm / người của tổ'
                      }
                      className={cn(
                        c,
                        'num border-t border-l border-[var(--line)] bg-[var(--surface-raised)] px-0 text-center font-semibold',
                        thap && 'bg-[var(--warn-wash)] text-[var(--warn)]',
                      )}
                    >
                      {n.daLay ? `${n.diLam}/${nguoi}` : '·'}
                    </td>
                  )
                })}
                {tongTo.map((v, i) => (
                  <td
                    key={TONG[i][0]}
                    className={cn(
                      c,
                      tong(i),
                      'z-[4] border-t border-[var(--line)] font-semibold',
                      mauTong(
                        i,
                        [b.tong.diLam, 0, 0, b.tong.tc, b.tong.vang, b.tong.canXuLy][i],
                      ),
                    )}
                    style={{ right: phai(i), textAlign: 'right', zIndex: 7 }}
                  >
                    {v}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </KhungTrang>
  )
}
