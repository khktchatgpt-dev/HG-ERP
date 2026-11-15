'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ApNhom,
  ApNut,
  DauTrang,
  Rong,
  SxKhung,
  TabNgang,
  ThanhTT,
} from '@/app/(workspace)/production/_erp/khung'
import { doiThang, type ScdLenh } from '@/lib/so-cong-doan'
import type { SoCongDoanPayload } from '@/modules/dept/production/so-cong-doan.service'
import { BangThang } from './bang-thang'
import { cx, fmt } from '../da-ghi/so-da-ghi.shared'

/**
 * SỔ CÔNG ĐOẠN — khuôn C, KHÔNG kit (bản vẽ 14/11/2026
 * https://claude.ai/artifact/CpB5jKcS9Swtx6cHqKUyXx, duyệt Q1–Q6).
 *
 * Trả lời: "công đoạn này cả tháng đã làm gì mỗi ngày, chi tiết nào còn thiếu?" —
 * đúng tờ PHÔI / HÀN / NGUỘI / SƠN của sổ Excel thống kê: dải tờ công đoạn, hàng
 * lệnh → mã hàng → chi tiết, một cột mỗi ngày, Cần · Đã làm · Còn đứng yên bên
 * trái. Chỉ để XEM — bấm ô ngày sang Sổ theo ngày để sửa (một chỗ sửa, có chốt sổ).
 */
export function SoCongDoanScreen({ p }: { p: SoCongDoanPayload }) {
  const router = useRouter()
  const [dangTai, startTai] = useTransition()
  const [tim, setTim] = useState('')
  /** Mã hàng đang gập — khoá `lsx|mã`. Mặc định mở hết, như tờ Excel. */
  const [gap, setGap] = useState<Set<string>>(() => new Set())

  const href = (o: { thang?: string; cd?: string | null; ca?: boolean }) => {
    const sp = new URLSearchParams()
    const thang = o.thang ?? p.thang
    if (thang !== p.today.slice(0, 7)) sp.set('thang', thang)
    const cd = o.cd === undefined ? p.cd : o.cd
    if (cd) sp.set('cd', cd)
    if (o.ca ?? p.ca) sp.set('ca', '1')
    const s = sp.toString()
    return `/thongke/so-cong-doan${s ? `?${s}` : ''}`
  }
  const go = (u: string) => startTai(() => router.push(u))

  const q = tim.trim().toLowerCase()
  const lenh: ScdLenh[] = useMemo(() => {
    if (!q) return p.lenh
    return p.lenh
      .map((L) => ({
        ...L,
        ma: L.ma
          .map((m) => {
            const maKhop = [L.lsx_code, m.code, m.ten].some((s) =>
              (s ?? '').toLowerCase().includes(q),
            )
            return maKhop
              ? m
              : {
                  ...m,
                  dong: m.dong.filter((d) =>
                    [d.ten, d.cum].some((s) => (s ?? '').toLowerCase().includes(q)),
                  ),
                }
          })
          .filter((m) => m.dong.length > 0),
      }))
      .filter((L) => L.ma.length > 0)
  }, [p.lenh, q])

  const khoaMa = lenh.flatMap((L) => L.ma.map((m) => `${L.lsx_id}|${m.code ?? ''}`))
  const tatCaMo = khoaMa.every((k) => !gap.has(k))
  const soDong = lenh.reduce((a, L) => a + L.ma.reduce((b, m) => b + m.dong.length, 0), 0)
  const [y, m] = p.thang.split('-')
  const tenThang = `tháng ${Number(m)}/${y}`

  return (
    <SxKhung label="Sổ công đoạn">
      <div className="sx-body">
        <DauTrang
          crumb="Thống kê sản xuất › Ghi sổ hằng ngày"
          title="Sổ công đoạn"
          ctx={
            <>
              {p.cd_label ? <b>{p.cd_label}</b> : 'Chưa có tờ'} · {tenThang} ·{' '}
              <b>{fmt(soDong)}</b> chi tiết{' '}
              {p.ca ? 'của lệnh đang chạy' : 'có ghi trong tháng'}
              {dangTai && <span className="mut"> · đang tải…</span>}
            </>
          }
          actions={
            <>
              {khoaMa.length > 1 && (
                <ApNhom>
                  <ApNut onClick={() => setGap(tatCaMo ? new Set(khoaMa) : new Set())}>
                    {tatCaMo ? 'Gập hết' : 'Mở hết'}
                  </ApNut>
                </ApNhom>
              )}
              <ApNhom>
                <ApNut href="/thongke/da-ghi">Sổ theo ngày</ApNut>
              </ApNhom>
              <ApNhom>
                <ApNut
                  primary
                  href={p.cd ? `/thongke/ghi?stage=${p.cd}` : '/thongke/ghi'}
                >
                  Ghi sản lượng
                </ApNut>
              </ApNhom>
            </>
          }
        />

        {/* Dải TỜ công đoạn — như dãy sheet PHÔI · HÀN · NGUỘI · SƠN của sổ Excel. */}
        {p.to_cong_doan.length > 0 && (
          <TabNgang
            label="Tờ công đoạn"
            tabs={p.to_cong_doan.map((t) => ({
              key: t.code,
              label: t.label,
              n: t.n,
              on: t.code === p.cd,
              onClick: () => go(href({ cd: t.code })),
            }))}
          />
        )}

        <div className="sx-hc">
          <Link href={href({ thang: doiThang(p.thang, -1) })} className="c">
            ‹ tháng trước
          </Link>
          <span className="c on">
            <b>
              Tháng {Number(m)}/{y}
            </b>
          </span>
          {p.thang < p.today.slice(0, 7) ? (
            <Link href={href({ thang: doiThang(p.thang, 1) })} className="c">
              tháng sau ›
            </Link>
          ) : (
            <span className="c" style={{ color: 'var(--sx-empty)' }}>
              tháng sau ›
            </span>
          )}
          <span className="sep" />
          <span role="group" aria-label="Chi tiết bày" style={{ display: 'contents' }}>
            <button
              type="button"
              className={cx('c', !p.ca && 'on')}
              aria-pressed={!p.ca}
              onClick={() => go(href({ ca: false }))}
            >
              Chỉ chi tiết có ghi trong tháng
            </button>
            <button
              type="button"
              className={cx('c', p.ca && 'on')}
              aria-pressed={p.ca}
              onClick={() => go(href({ ca: true }))}
            >
              Cả chi tiết của lệnh đang chạy
            </button>
          </span>
          <input
            className="sx-in"
            value={tim}
            onChange={(e) => setTim(e.target.value)}
            placeholder="Tìm lệnh, mã hàng, chi tiết"
            aria-label="Tìm lệnh, mã hàng, chi tiết"
            style={{ width: 220, marginLeft: 'auto' }}
          />
        </div>

        {!p.cd ? (
          <Rong
            tieuDe={`${tenThang[0].toUpperCase()}${tenThang.slice(1)} chưa có dòng sổ chính thức nào`}
            lyDo="Tờ công đoạn chỉ bày dòng đã Ghi sổ chính thức — nháp chưa vào số."
            tiep={
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <Link href="/thongke/ghi" className="sx-btn p">
                  Ghi sản lượng
                </Link>
                <Link href={href({ thang: doiThang(p.thang, -1) })} className="sx-btn">
                  Tháng trước
                </Link>
              </span>
            }
          />
        ) : p.lenh.length === 0 ? (
          <Rong
            tieuDe={`Tờ ${p.cd_label} ${tenThang} chưa có dòng chính thức`}
            lyDo={
              p.ca
                ? 'Không lệnh đang chạy nào đi qua công đoạn này.'
                : 'Chưa ai ghi sổ chính thức ở công đoạn này trong tháng.'
            }
            tiep={
              <span style={{ display: 'inline-flex', gap: 6 }}>
                {!p.ca && (
                  <button
                    type="button"
                    className="sx-btn"
                    onClick={() => go(href({ ca: true }))}
                  >
                    Xem cả chi tiết của lệnh đang chạy
                  </button>
                )}
                <Link href={href({ thang: doiThang(p.thang, -1) })} className="sx-btn">
                  Tháng trước
                </Link>
              </span>
            }
          />
        ) : lenh.length === 0 ? (
          <Rong
            tieuDe="Không chi tiết nào khớp"
            lyDo={`Không lệnh, mã hàng hay chi tiết nào có “${tim.trim()}”.`}
            tiep={
              <button type="button" className="sx-btn" onClick={() => setTim('')}>
                Bỏ tìm
              </button>
            }
          />
        ) : (
          <BangThang
            p={p}
            lenh={lenh}
            soDong={soDong}
            gap={gap}
            doiGap={(k) =>
              setGap((s) => {
                const n = new Set(s)
                if (n.has(k)) n.delete(k)
                else n.add(k)
                return n
              })
            }
            mo={dangTai}
          />
        )}

        <ThanhTT
          left="Ô ngày = đạt chính thức của chi tiết trong ngày · bấm ô để mở Sổ theo ngày"
          right="Cần · Đã làm lấy đúng ô Hồ sơ lệnh"
        />
      </div>
    </SxKhung>
  )
}
