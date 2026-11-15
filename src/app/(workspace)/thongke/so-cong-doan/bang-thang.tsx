'use client'

import { Fragment, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { ScdDong, ScdLenh } from '@/lib/so-cong-doan'
import type { SoCongDoanPayload } from '@/modules/dept/production/so-cong-doan.service'
import { cx, fmt } from '../da-ghi/so-da-ghi.shared'

/**
 * LƯỚI THÁNG của Sổ công đoạn — như tờ công đoạn Excel có "cố định cột": bốn cột
 * trái (chi tiết · Cần · Đã làm · Còn) dính khi cuộn ngang, đầu cột ngày dính khi
 * cuộn dọc. Không có cột tổng dọc giữa các chi tiết (cộng chi tiết khác nhau là số
 * vô nghĩa); hàng mã hàng nói "xong x/y" và số chi tiết có ghi mỗi ngày.
 */
const W = { c1: 240, c2: 64, c3: 64, c4: 64, ngay: 38, tong: 70 }
const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const thuOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()

export function BangThang({
  p,
  lenh,
  soDong,
  gap,
  doiGap,
  mo,
}: {
  p: SoCongDoanPayload
  lenh: ScdLenh[]
  soDong: number
  gap: Set<string>
  doiGap: (k: string) => void
  /** Đang tải tháng / tờ khác — mờ lưới, khỏi bấm nhầm số cũ. */
  mo: boolean
}) {
  const khung = useRef<HTMLDivElement>(null)
  const rong = W.c1 + W.c2 + W.c3 + W.c4 + p.ngay.length * W.ngay + W.tong

  // Mở ra cuộn sẵn tới hôm nay (Q2) — tháng này thì cột hôm nay sát mép phải vùng nhìn.
  useEffect(() => {
    const el = khung.current
    const th = el?.querySelector<HTMLElement>('th.hn')
    if (!el || !th) return
    el.scrollLeft = Math.max(0, th.offsetLeft - el.clientWidth + W.ngay * 3)
  }, [])

  const tatCa = lenh.flatMap((L) => L.ma.flatMap((m) => m.dong))
  const soCtNgay = (ds: ScdDong[], iso: string) => ds.filter((d) => d.ngay[iso]).length
  const lopNgay = (iso: string) =>
    cx('d', thuOf(iso) === 0 && 'cn', iso === p.today && 'hn')

  return (
    <div className="sx-grid" ref={khung} style={mo ? { opacity: 0.55 } : undefined}>
      <table className="sx-tb sx-scd" style={{ width: rong }}>
        <colgroup>
          <col style={{ width: W.c1 }} />
          <col style={{ width: W.c2 }} />
          <col style={{ width: W.c3 }} />
          <col style={{ width: W.c4 }} />
          {p.ngay.map((iso) => (
            <col key={iso} style={{ width: W.ngay }} />
          ))}
          <col style={{ width: W.tong }} />
        </colgroup>
        <thead>
          <tr>
            <th className="f c1">Lệnh · mã hàng · chi tiết</th>
            <th className="f c2 r" title="Cần làm ở công đoạn này — ô Hồ sơ lệnh">
              Cần
            </th>
            <th className="f c3 r" title="Đã làm chính thức tới nay — ô Hồ sơ lệnh">
              Đã làm
            </th>
            <th className="f c4 r">Còn</th>
            {p.ngay.map((iso) => (
              <th
                key={iso}
                className={cx('dh', thuOf(iso) === 0 && 'cn', iso === p.today && 'hn')}
                title={`${THU[thuOf(iso)]} ${iso.slice(8)}/${iso.slice(5, 7)}`}
              >
                {Number(iso.slice(8))}
                <span>{THU[thuOf(iso)]}</span>
              </th>
            ))}
            <th className="r">Σ tháng</th>
          </tr>
        </thead>
        <tbody>
          {lenh.map((L) => (
            <Fragment key={L.lsx_id}>
              <tr className="lenh">
                <td className="f c1">
                  Lệnh{' '}
                  <Link href={`/thongke/lsx/${L.lsx_id}`} className="ma lnk">
                    {L.lsx_code}
                  </Link>
                </td>
                <td className="f c2" />
                <td className="f c3" />
                <td className="f c4" />
                <td colSpan={p.ngay.length + 1} />
              </tr>
              {L.ma.map((m) => {
                const k = `${L.lsx_id}|${m.code ?? ''}`
                const dong = !gap.has(k)
                const ten = [m.code ?? '—', m.ten].filter(Boolean).join(' ')
                return (
                  <Fragment key={k}>
                    <tr className="mh">
                      <td className="f c1" title={ten}>
                        <button
                          type="button"
                          className="tg"
                          onClick={() => doiGap(k)}
                          aria-expanded={dong}
                          aria-label={`${dong ? 'Gập' : 'Mở'} ${m.code ?? 'chi tiết không mã'}`}
                        >
                          {dong ? '▾' : '▸'}
                        </button>
                        <span className="ma">{m.code ?? '—'}</span>
                        {m.ten && <span className="mut"> {m.ten}</span>}
                      </td>
                      <td className="f c2" />
                      <td className="f c3" />
                      <td className="f c4 r mut" title="Chi tiết đã làm đủ cần">
                        {fmt(m.xong)}/{fmt(m.dong.length)} xong
                      </td>
                      {p.ngay.map((iso) => {
                        const n = soCtNgay(m.dong, iso)
                        return (
                          <td
                            key={iso}
                            className={cx(lopNgay(iso), 'mut')}
                            title={
                              n
                                ? `${n} chi tiết ghi ngày ${iso.slice(8)}/${iso.slice(5, 7)}`
                                : undefined
                            }
                          >
                            {n || ''}
                          </td>
                        )
                      })}
                      <td className="r mut">{fmt(m.dong.length)} c.tiết</td>
                    </tr>
                    {dong &&
                      m.dong.map((d) => (
                        <HangCt key={d.key} p={p} d={d} lopNgay={lopNgay} />
                      ))}
                  </Fragment>
                )
              })}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="f c1">
              {fmt(soDong)} chi tiết ·{' '}
              {p.ca ? 'của lệnh đang chạy' : 'có ghi trong tháng'}
            </td>
            <td className="f c2" />
            <td className="f c3" />
            <td className="f c4" />
            {p.ngay.map((iso) => {
              const n = soCtNgay(tatCa, iso)
              return (
                <td key={iso} className={cx(lopNgay(iso), 'mut')}>
                  {n || ''}
                </td>
              )
            })}
            <td
              className="r mut"
              title="Số chi tiết có ghi mỗi ngày — không cộng số lượng"
            >
              c.tiết/ngày
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function HangCt({
  p,
  d,
  lopNgay,
}: {
  p: SoCongDoanPayload
  d: ScdDong
  lopNgay: (iso: string) => string
}) {
  const con = d.can != null && d.da_lam != null ? d.can - d.da_lam : null
  const ten = [d.cum, d.ten].filter(Boolean).join(' · ')
  return (
    <tr className="r">
      <td className="f c1" title={ten}>
        {d.cum && <span className="mut">{d.cum} · </span>}
        {d.ten}
      </td>
      <td className={cx('f c2 r num', d.can == null && 'empty')}>
        {d.can == null ? '—' : fmt(d.can)}
      </td>
      <td className={cx('f c3 r num', d.da_lam == null && 'empty')}>
        {d.da_lam == null ? '—' : fmt(d.da_lam)}
      </td>
      <td
        className={cx(
          'f c4 r num',
          con == null ? 'empty' : con === 0 ? 'ok' : con > 0 ? 'warn' : 'stop',
        )}
        title={con != null && con < 0 ? `Đã làm vượt cần ${fmt(-con)}` : undefined}
      >
        {con == null ? '—' : con === 0 ? 'đủ' : con > 0 ? fmt(con) : `+${fmt(-con)}`}
      </td>
      {p.ngay.map((iso) => {
        const v = d.ngay[iso]
        if (!v) return <td key={iso} className={lopNgay(iso)} />
        const to = d.to[iso]
        const href = `/thongke/da-ghi?${new URLSearchParams({
          date: iso,
          to: to ?? 'all',
          ...(p.cd ? { cd: p.cd } : {}),
        }).toString()}`
        return (
          <td key={iso} className={cx(lopNgay(iso), 'cl')}>
            <Link
              href={href}
              title={`${iso.slice(8)}/${iso.slice(5, 7)} · ${d.ten}: ${fmt(v)}${to ? ` · ${p.teams[to] ?? ''}` : ' · nhiều tổ'} — mở Sổ theo ngày`}
            >
              {fmt(v)}
            </Link>
          </td>
        )
      })}
      <td className="r num tong">{d.thang ? fmt(d.thang) : ''}</td>
    </tr>
  )
}
