'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Empty } from '@/components/kit'
import { cn } from '@/lib/utils'
import { CHUA_BO_PHAN, tinhCoMat } from '@/lib/cham-cong/co-mat'
import type { KyCong } from './ky-cong.shared'
import { THU, dm, thu } from './ky-cong.shared'
import { so } from './cham-cong.shared'

/**
 * CÓ MẶT THEO NGÀY × TỔ — cách xem thứ hai của bước ① (bản vẽ Comat.dc.html, duyệt
 * 16/10/2026). Ô = số người có ít nhất 1 lượt quẹt trong ngày; KHÔNG tính công, nên
 * không phụ thuộc luật ca. Mẫu số = nhân viên đang làm, trừ người Không chấm công.
 *
 * Màu (câu 13, dùng tạm): ≥ 85% không tô · 60–85% cam · < 60% đỏ. Chủ nhật không tô,
 * không vào trung bình (câu 12). Ngày cả công ty chưa có lượt nào = chưa lấy về →
 * để trống, không tính là vắng.
 */

const CHUA_BP = CHUA_BO_PHAN

type Chon = { to: string; ngay: string }

export function CoMat({
  k,
  onXemLuot,
  onMoNguoi,
}: {
  k: KyCong
  /** Mở cách xem "Lượt từng người" lọc đúng ngày + bộ phận. */
  onXemLuot: (ngay: string, boPhan: string) => void
  /** Mở ngăn "Chấm công một người". */
  onMoNguoi: (ma: string) => void
}) {
  const [chon, setChon] = useState<Chon | null>(null)

  const m = useMemo(
    () => ({
      ...tinhCoMat({
        theoNgay: k.du.theoNgay,
        dong: k.du.dong,
        nhanSu: [...k.du.nhanSu, ...k.du.daNghi],
        homNay: k.homNay,
      }),
      // (ngày|mã) → dòng lượt của người đó, cho ngăn chi tiết
      dong: new Map(
        k.du.dong.filter((r) => r.daGhep).map((r) => [`${r.ngay}|${r.ma}`, r] as const),
      ),
    }),
    [k],
  )

  if (k.du.nhanSu.length === 0)
    return (
      <div className="flex-1 bg-[var(--surface-card)]">
        <Empty
          headline="Chưa có nhân viên nào cần chấm công"
          reason="Bảng có mặt đếm theo danh sách nhân viên đang làm, trừ người Không chấm công."
          next="Vào ② Nhân viên & ca để thêm hoặc ghép nhân viên."
        />
      </div>
    )

  const c = 'border-b border-[var(--line-faint)]/40 whitespace-nowrap'
  const h = cn(
    c,
    'sticky top-0 z-[2] border-[var(--line)] bg-[var(--surface-raised)] font-semibold text-[var(--ink-2)]',
  )
  const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`)
  const mau = (n: number | null, tong: number, d: string) => {
    if (n == null || thu(d) === 0 || tong === 0) return ''
    const r = n / tong
    return r >= 0.85
      ? ''
      : r >= 0.6
        ? 'bg-[var(--warn-wash)] text-[var(--warn)]'
        : 'bg-[var(--stop-wash)] text-[var(--stop)] font-semibold'
  }

  const sel = chon ? m.tos.find((t) => t.to === chon.to) : undefined

  return (
    <>
      <div className="text-k-label flex flex-wrap items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1 text-[var(--ink-2)]">
        <span>Ô = số người có ít nhất 1 lượt quẹt trong ngày</span>
        <span className="num border border-[var(--line)] px-1.5">≥ 85%</span>
        <span className="num bg-[var(--warn-wash)] px-1.5 text-[var(--warn)]">
          60–85%
        </span>
        <span className="num bg-[var(--stop-wash)] px-1.5 text-[var(--stop)]">
          &lt; 60%
        </span>
        <span className="num bg-[var(--chrome)] px-1.5">CN — không tô</span>
        <span className="ml-auto">
          Không gồm {so(k.du.khongCham)} người Không chấm công · lượt của mã máy chưa ghép
          người
        </span>
      </div>
      <div
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-[var(--surface-card)]"
        role="region"
        aria-label="Có mặt theo ngày và tổ"
        tabIndex={0}
      >
        {/* Không cuộn ngang (17/10/2026): bảng vừa khung, cột ngày chia đều phần còn lại. */}
        <table className="text-k-sm w-full table-fixed border-separate border-spacing-0">
          <colgroup>
            <col style={{ width: 176 }} />
            {m.ngays.map((d) => (
              <col key={d} />
            ))}
            <col style={{ width: 50 }} />
          </colgroup>
          <thead>
            <tr>
              <th
                className={cn(h, 'left-0 z-[3] px-2.5 text-left')}
                style={{ position: 'sticky' }}
              >
                Tổ / bộ phận <span className="font-normal">· người</span>
              </th>
              {m.ngays.map((d) => (
                <th
                  key={d}
                  className={cn(
                    h,
                    'border-l px-0 text-center text-[11px] leading-3',
                    thu(d) === 0 && 'bg-[var(--chrome)]',
                  )}
                >
                  {Number(d.slice(8))}
                  <br />
                  {THU[thu(d)]}
                </th>
              ))}
              <th
                className={cn(h, 'border-l px-1.5 text-[11px] leading-3')}
                style={{ textAlign: 'right' }}
                title="Trung bình có mặt các ngày thường đã có dữ liệu (bỏ chủ nhật)"
              >
                TB
                <br />
                ngày thường
              </th>
            </tr>
          </thead>
          <tbody>
            {m.tos.map((t) => (
              <tr key={t.to}>
                <td
                  className={cn(
                    c,
                    'sticky left-0 z-[1] bg-[var(--surface-card)] px-2.5',
                    t.to === CHUA_BP && 'text-[var(--stop)]',
                  )}
                >
                  <span className="flex justify-between gap-1" title={t.to}>
                    <Link
                      href={`/hr/cham-cong/gio-cong?thang=${k.thang}&bp=${encodeURIComponent(t.to)}`}
                      className="truncate text-[var(--act-text)] hover:underline"
                    >
                      {t.to}
                    </Link>
                    <span className="num shrink-0 text-[var(--ink-3)]">
                      {so(t.ds.length)}
                    </span>
                  </span>
                </td>
                {m.ngays.map((d, i) => {
                  const n = t.ngay[i]
                  const on = chon?.to === t.to && chon.ngay === d
                  return (
                    <td
                      key={d}
                      className={cn(
                        c,
                        'border-l p-0',
                        thu(d) === 0 && 'bg-[var(--chrome)]/60',
                        mau(n, t.mau[i], d),
                      )}
                    >
                      {n == null ? (
                        <span className="block text-center text-[var(--ink-3)]">·</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setChon(on ? null : { to: t.to, ngay: d })}
                          aria-label={`${t.to} ngày ${dm(d)}: ${n}/${t.mau[i]} có mặt`}
                          aria-pressed={on}
                          className={cn(
                            'num block h-7 w-full text-center hover:bg-[var(--surface-hover)]',
                            on && 'outline-2 -outline-offset-2 outline-[var(--act)]',
                          )}
                        >
                          {n}
                          <span className="text-[10px] text-[var(--ink-3)]">
                            /{t.mau[i]}
                          </span>
                        </button>
                      )}
                    </td>
                  )
                })}
                <td
                  className={cn(
                    c,
                    'num border-l bg-[var(--surface-raised)] px-1.5',
                    t.tb != null && t.tb < 0.6 && 'text-[var(--stop)]',
                  )}
                  style={{ textAlign: 'right' }}
                >
                  {pct(t.tb)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td
                className={cn(
                  c,
                  'sticky bottom-0 left-0 z-[3] border-t border-[var(--line)] bg-[var(--surface-raised)] px-2.5 font-semibold',
                )}
              >
                <span className="flex justify-between gap-1">
                  <span>Toàn công ty</span>
                  <span className="num">{so(m.tongNguoi)}</span>
                </span>
              </td>
              {m.ngays.map((d, i) => (
                <td
                  key={d}
                  className={cn(
                    c,
                    'num sticky bottom-0 z-[2] border-t border-l border-[var(--line)] bg-[var(--surface-raised)] text-center font-semibold',
                  )}
                >
                  {m.tong[i] ?? '·'}
                </td>
              ))}
              <td
                className={cn(
                  c,
                  'num sticky bottom-0 z-[2] border-t border-l border-[var(--line)] bg-[var(--surface-raised)] px-1.5 font-semibold',
                )}
                style={{ textAlign: 'right' }}
              >
                {pct(m.tbTong)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {chon && sel && (
        <ChiTiet
          chon={chon}
          ds={sel.ds}
          dong={m.dong}
          k={k}
          onXemLuot={onXemLuot}
          onMoNguoi={onMoNguoi}
        />
      )}
    </>
  )
}

/** Ngăn dưới: ai có mặt (vào · ra · số lượt), ai không quẹt (lượt gần nhất trong kỳ). */
function ChiTiet({
  chon,
  ds,
  dong,
  k,
  onXemLuot,
  onMoNguoi,
}: {
  chon: Chon
  ds: { ma: string; ten: string }[]
  dong: Map<string, KyCong['du']['dong'][number]>
  k: KyCong
  onXemLuot: (ngay: string, boPhan: string) => void
  onMoNguoi: (ma: string) => void
}) {
  const coMat = ds
    .map((x) => ({ x, r: dong.get(`${chon.ngay}|${x.ma}`) }))
    .filter((v) => v.r)
    .sort((a, b) => a.r!.luot[0].gio.localeCompare(b.r!.luot[0].gio))
  const vang = ds
    .filter((x) => !dong.has(`${chon.ngay}|${x.ma}`))
    .map((x) => {
      const truoc = k.du.dong
        .filter((r) => r.daGhep && r.ma === x.ma && r.ngay < chon.ngay)
        .map((r) => r.ngay)
        .sort()
        .at(-1)
      return { x, truoc }
    })
  const li =
    'flex justify-between gap-2 border-b border-dotted border-[var(--line-faint)] py-0.5'
  return (
    <section
      aria-label="Chi tiết ô đang chọn"
      className="text-k-sm flex max-h-[180px] shrink-0 border-t border-[var(--line)] bg-[var(--surface-card)]"
    >
      <div className="w-56 shrink-0 border-r border-[var(--line)] px-3.5 py-2">
        <div className="text-k-label text-[var(--ink-2)]">Đang xem</div>
        <div className="font-semibold">
          {chon.to} · {THU[thu(chon.ngay)]} {dm(chon.ngay)}
        </div>
        <div className="num text-[20px] font-semibold">
          {coMat.length}{' '}
          <span className="text-k-sm font-normal text-[var(--ink-2)]">
            / {ds.length} có mặt
          </span>
        </div>
        <button
          type="button"
          className="mt-1 text-[var(--act-text)] underline"
          onClick={() => onXemLuot(chon.ngay, chon.to === CHUA_BP ? '' : chon.to)}
        >
          Xem lượt quẹt của ngày này
        </button>
      </div>
      <div className="min-w-0 flex-1 overflow-auto border-r border-[var(--line)] px-3.5 py-2">
        <div className="text-k-label mb-0.5 text-[var(--ink-2)]">
          Có mặt <b className="text-[var(--ink)]">{coMat.length}</b> — vào · ra · số lượt
        </div>
        {coMat.map(({ x, r }) => (
          <div key={x.ma} className={li}>
            <button
              type="button"
              className="text-left text-[var(--act-text)] hover:underline"
              onClick={() => onMoNguoi(x.ma)}
            >
              {x.ten}
            </button>
            <span className={cn('num', r!.luot.length < 2 && 'text-[var(--warn)]')}>
              {r!.luot[0].gio.slice(0, 5)} ·{' '}
              {r!.luot.length > 1 ? r!.luot.at(-1)!.gio.slice(0, 5) : '—'} ·{' '}
              {r!.luot.length} lượt
            </span>
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-auto px-3.5 py-2">
        <div className="text-k-label mb-0.5 text-[var(--ink-2)]">
          Không quẹt <b className="text-[var(--ink)]">{vang.length}</b> — lượt gần nhất
          trong kỳ
        </div>
        {vang.map(({ x, truoc }) => (
          <div key={x.ma} className={li}>
            <button
              type="button"
              className="text-left text-[var(--act-text)] hover:underline"
              onClick={() => onMoNguoi(x.ma)}
            >
              {x.ten}
            </button>
            <span className="num text-[var(--ink-3)]">
              {truoc ? dm(truoc) : 'chưa quẹt trong kỳ'}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
