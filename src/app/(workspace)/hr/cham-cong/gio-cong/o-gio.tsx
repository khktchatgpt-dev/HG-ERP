'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Btn, NumInput, Tick } from '@/components/kit'
import { TEN_NGHI } from '@/lib/cham-cong/dieu-chinh'
import { nhanTc } from '@/lib/cham-cong/chi-tiet-cong'
import { congNgay } from '@/lib/cham-cong/ky-gio-cong'
import { tenMay } from '@/lib/cham-cong/mot-nguoi'
import type { GioCongCtx } from './useGioCong'
import { THU, dm, gio, hm, so, thu } from './gio-cong.shared'

/**
 * KHUNG NỔI MỘT Ô — "ngày này người này được tính ra sao, sửa gì?". Bày lượt máy, giờ
 * dùng để tính (sau ân hạn / làm tròn), giờ từng khung, làm trưa; nút Điều chỉnh mở đúng
 * ngăn điều chỉnh có duyệt đã có (bổ sung giờ, nghỉ có lý do, bỏ lượt sai).
 *
 * Viết tay thay `Popover` của kit: Popover cần một nút kích hoạt gắn sẵn — lưới có tới
 * ~3.600 ô, mỗi ô một Radix root là quá nặng. Một khung `fixed` đặt theo toạ độ ô bấm.
 */
export function OGio({ d }: { d: GioCongCtx }) {
  const ref = useRef<HTMLDivElement>(null)
  const o = d.o
  useEffect(() => {
    if (!o) return
    const tat = (e: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest('td')
      )
        d.setO(null)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && d.setO(null)
    document.addEventListener('mousedown', tat)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', tat)
      document.removeEventListener('keydown', esc)
    }
  }, [o, d])
  if (!o) return null
  const n = d.nguoiCua(o.ma)
  const x = n && d.ngayCua(n, o.ngay)
  if (!n || !x) return null
  const c = d.congCua(o.ma)?.ngay.get(o.ngay)
  const nhan = nhanTc(d.b.thamSo)
  // Lượt quẹt ở máy nào (user 20/10/2026): tra giờ máy ghi → máy; giờ '(+1)' là lượt
  // rạng sáng hôm sau của ca qua đêm. Lượt bổ sung bằng điều chỉnh không có máy.
  const mayCua = (g: string) => {
    const sau = /\(\+1\)$/.test(g)
    const ngay = sau ? congNgay(o.ngay, 1) : o.ngay
    const l = (d.b.luotMay[`${o.ma}|${ngay}`] ?? []).find(
      (x) => x.gio.slice(0, 5) === g.slice(0, 5),
    )
    return l ? tenMay(l.may) : 'bổ sung'
  }

  const W = 380
  const left = Math.min(o.x, window.innerWidth - W - 12)
  const top = o.y + 4 + 330 > window.innerHeight ? Math.max(8, o.y - 360) : o.y + 4

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${n.ten} ngày ${dm(o.ngay)}`}
      className="text-k-sm fixed z-[60] border border-[var(--line)] bg-[var(--surface-card)] shadow-[0_8px_24px_rgba(18,22,31,.16)]"
      style={{ left, top, width: W }}
    >
      <header className="flex items-baseline gap-2 border-b border-[var(--line-faint)]/50 px-2.5 py-1.5">
        <b className="text-k-body">{n.ten}</b>
        <span className="num text-[var(--ink-3)]" style={{ textAlign: 'left' }}>
          {THU[thu(o.ngay)]} {dm(o.ngay)}
        </span>
        <Link
          href={`/hr/cham-cong/nguoi/${encodeURIComponent(n.ma)}?thang=${d.b.thang}`}
          className="ml-auto text-[var(--act-text)] underline"
        >
          Xem cả kỳ
        </Link>
      </header>
      <div className="grid gap-2 px-2.5 py-2">
        {!x.luot.length && <div className="text-[var(--ink-2)]">Không có lượt máy.</div>}
        {x.daSua && (
          <div className="text-[var(--act-text)]">
            Giờ vào/ra đã gồm điều chỉnh đã duyệt.
          </div>
        )}
        {!x.k && x.doDang && (
          <div className="text-[var(--ink-2)]">
            Ngày đang dở: dữ liệu lấy về giữa ngày nên mới có lượt vào. Lấy lại dữ liệu
            sau giờ tan ca.
          </div>
        )}
        {x.nghi && (
          <div className="text-[var(--warn)]">Nghỉ có lý do: {TEN_NGHI[x.nghi]}</div>
        )}
        {x.thieu && (
          <div className="text-[var(--stop)]">
            Chỉ 1 lượt → không tính được giờ. Bổ sung giờ thật theo phiếu (người lao động
            ký, tổ trưởng xác nhận).
          </div>
        )}
        {n.cachTinh === 'ngay' && x.k && (
          <div className="text-[var(--ink-2)]">
            {n.boPhan} không tính theo khung giờ: có quẹt trong ngày = 1 công.
          </div>
        )}
        {n.cachTinh === 'du' && x.k && (
          <div className="text-[var(--ink-2)]">
            {x.khongQuet
              ? 'Không quẹt, không có đơn nghỉ — vẫn đủ 1 công. Người nghỉ mà chưa nộp đơn thì làm phiếu Nghỉ cho ngày này.'
              : `${n.boPhan} tính đủ công: ngày làm việc = 1 công, chỉ trừ ngày nghỉ có đơn.`}
          </div>
        )}
        {c && c.cap.length > 0 && (
          <table className="w-full border-separate border-spacing-0 font-mono text-[11.5px]">
            <tbody>
              {c.cap.map((p, i) => (
                <tr key={i}>
                  <td className="py-0.5 pr-2 font-sans text-[var(--ink-3)]">
                    Vào {i + 1} · Ra {i + 1}
                  </td>
                  <td className="py-0.5" style={{ textAlign: 'left' }}>
                    <b>{p.vao}</b>{' '}
                    <span className="font-sans text-[10.5px] text-[var(--ink-3)]">
                      {mayCua(p.vao)}
                    </span>{' '}
                    → <b>{p.ra ?? '?'}</b>{' '}
                    {p.ra && (
                      <span className="font-sans text-[10.5px] text-[var(--ink-3)]">
                        {mayCua(p.ra)}
                      </span>
                    )}
                  </td>
                  <td
                    className="py-0.5 text-[var(--ink-3)]"
                    style={{ textAlign: 'right' }}
                  >
                    {p.vaoTinh ? `tính ${p.vaoTinh}→${p.raTinh}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {c && c.luotLe.length > 0 && (
          <div className="text-[var(--ink-3)]">
            Lượt giữa {c.luotLe.join(', ')} không tính (3 lượt: tính lượt đầu → lượt
            cuối).
          </div>
        )}
        {x.xuyenTrua && <Trua d={d} ma={n.ma} ngay={o.ngay} phut={x.trua} />}
        {c?.tinhDuoc && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-t border-[var(--line-faint)]/50 pt-1.5">
            <dt className="text-[var(--ink-2)]">Hành chính</dt>
            <dd className="num font-semibold">
              {gio(c.hc)} giờ ÷ {gio(d.b.phutMotCong)} = {so(c.hc / d.b.phutMotCong, 2)}{' '}
              công
            </dd>
            {(['tc1', 'tc2', 'tc3'] as const).map((k) => (
              <Fragment key={k}>
                <dt className="text-[var(--grp-1-ink)]">
                  {k.toUpperCase()} {nhan[k]}
                </dt>
                <dd className="num text-[var(--grp-1-ink)]">
                  {c[k] ? `${gio(c[k])} giờ` : '—'}
                </dd>
              </Fragment>
            ))}
            {(c.tre > 0 || c.som > 0) && (
              <>
                <dt className="text-[var(--warn)]">Trễ · sớm</dt>
                <dd className="num text-[var(--warn)]">
                  {c.tre} · {c.som} phút
                </dd>
              </>
            )}
          </dl>
        )}
        {x.choDuyet > 0 && (
          <div className="text-[var(--act-text)]">
            Có {x.choDuyet} điều chỉnh đang chờ duyệt — chưa tính vào số trên.
          </div>
        )}
      </div>
      <footer className="flex justify-end gap-1.5 border-t border-[var(--line-faint)]/50 px-2.5 py-1.5">
        <Btn onClick={() => d.setO(null)}>Đóng</Btn>
        {d.b.quyen.gui && (
          <Btn primary={x.thieu} icon="sua" onClick={() => d.moDieuChinh(n.ma, o.ngay)}>
            {x.thieu ? 'Bổ sung giờ…' : 'Điều chỉnh…'}
          </Btn>
        )}
      </footer>
    </div>
  )
}

/** Tick làm trưa ngay trên ô: mặc định 60 phút (ô sổ tay "x"), ghi được số phút khác. */
function Trua({
  d,
  ma,
  ngay,
  phut,
}: {
  d: GioCongCtx
  ma: string
  ngay: string
  phut: number
}) {
  const [p, setP] = useState(String(phut || d.b.phutTruaMacDinh))
  const co = phut > 0
  const soPhut = Math.max(1, Math.min(240, Math.round(Number(p.replace(',', '.')) || 0)))
  if (!d.b.quyen.trua) {
    return (
      <div className="text-[var(--ink-2)]">
        Có mặt xuyên trưa (đã trừ nghỉ trưa).{' '}
        {co ? `Đã tick làm trưa ${phut} phút.` : 'Chưa tick làm trưa.'}
      </div>
    )
  }
  return (
    <div className="grid gap-1 border-t border-[var(--line-faint)]/50 pt-1.5">
      <label className="flex items-center gap-2">
        <Tick
          label="Làm trưa"
          checked={co}
          disabled={d.dangGhi}
          onChange={(v) => d.ghiTrua([{ ma, ngay, phut: v ? soPhut : null }])}
        />
        <span>
          Làm trưa (sổ tay tổ trưởng): {phut || soPhut} phút × {d.b.heSoTrua} ={' '}
          <b className="font-mono">+{gio((phut || soPhut) * d.b.heSoTrua)} giờ</b> hành
          chính
        </span>
      </label>
      <div className="flex items-center gap-1.5 pl-6 text-[var(--ink-3)]">
        Số phút
        <div className="w-16">
          <NumInput aria-label="Số phút làm trưa" value={p} onCommit={setP} />
        </div>
        {co && Number(p) !== phut && (
          <Btn busy={d.dangGhi} onClick={() => d.ghiTrua([{ ma, ngay, phut: soPhut }])}>
            Lưu số phút
          </Btn>
        )}
      </div>
    </div>
  )
}
