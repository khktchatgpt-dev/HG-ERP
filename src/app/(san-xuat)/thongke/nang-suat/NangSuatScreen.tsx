'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ApNhom,
  ApNut,
  DauTrang,
  Rong,
  SxKhung,
  TabNgang,
  ThanhTT,
} from '@/app/(workspace)/production/_erp/khung'
import { COUNT_LEVEL_LABEL } from '@/lib/stage-config'
import { KY_NGAY, NGUONG_THAP, soDinhMuc, type NsO } from '@/lib/nang-suat'
import type {
  NangSuatHang,
  NangSuatPayload,
} from '@/modules/dept/production/nang-suat.service'

/**
 * NĂNG SUẤT — bản vẽ 11/11/2026 tab 3 (https://claude.ai/artifact/LocfQfiJSjv6Sxc8a9KQ6N,
 * Q2 + Q5 duyệt). KHÔNG kit, khung `production/_erp`.
 *
 * Quản đốc / GĐ — "Công đoạn, tổ nào chậm so với định mức? Ngày nào tụt?".
 * Bảng tóm (công đoạn hoặc tổ) + bảng chéo × ngày. Năng suất = Σ kg ÷ Σ giờ
 * công (lib/nang-suat), chỉ phiếu đã xác nhận. ĐM chưa đặt thì cột % ĐM và màu
 * "dưới định mức" tắt — phần còn lại vẫn chạy.
 */

type Theo = 'cong_doan' | 'to'

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
const fmt0 = (n: number) => Math.round(n).toLocaleString('vi-VN')
const pct = (p: number) => `${Math.round(p * 100)}%`
const dm = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7)
const dmy = (iso: string) => iso.split('-').reverse().join('/')
const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')

export function NangSuatScreen({
  data: p,
  theo: theo0,
}: {
  data: NangSuatPayload
  theo: Theo
}) {
  const [theo, setTheo] = useState<Theo>(theo0)
  const doiTab = (t: Theo) => {
    setTheo(t)
    // state PHẢI null — Next coi state mang cờ nội bộ là lệnh của nó (CLAUDE.md, B2 giao việc).
    const u = new URL(window.location.href)
    u.searchParams.set('theo', t)
    window.history.replaceState(null, '', u)
  }
  const rows = theo === 'to' ? p.to_xuong : p.cong_doan
  const coSoKy = p.total.docs > 0
  const missingKg = p.cong_doan.reduce((a, r) => a + r.missing_kg, 0)
  const noHours = p.cong_doan.reduce((a, r) => a + r.no_hours, 0)
  const kyHref = (k: number) => `/thongke/nang-suat?ky=${k}&theo=${theo}`

  return (
    <SxKhung bare label="Năng suất">
      <div className="sx-body">
        <DauTrang
          crumb="Theo dõi"
          title="Năng suất"
          ctx={
            <>
              kỳ{' '}
              <b>
                {dm(p.from)} – {dmy(p.to)}
              </b>{' '}
              · {p.total.docs} phiếu đã xác nhận
            </>
          }
          actions={
            <>
              <ApNhom>
                {KY_NGAY.map((k) =>
                  k === p.ky ? (
                    <span key={k} className="sx-btn on" aria-current="true">
                      {k} ngày
                    </span>
                  ) : (
                    <ApNut key={k} href={kyHref(k)}>
                      {k} ngày
                    </ApNut>
                  ),
                )}
              </ApNhom>
              <ApNhom>
                {coSoKy ? (
                  // <a> trần, KHÔNG next/link: Link prefetch một đường /api là dựng file hai lần.
                  <a
                    className="sx-btn"
                    href={`/api/dept/production/nang-suat?ky=${p.ky}&theo=${theo}`}
                  >
                    Xuất Excel
                  </a>
                ) : (
                  <ApNut why="Kỳ này chưa có phiếu">Xuất Excel</ApNut>
                )}
              </ApNhom>
            </>
          }
        />

        <TabNgang
          label="Năng suất theo"
          tabs={[
            {
              key: 'cong_doan',
              label: 'Theo công đoạn',
              n: p.cong_doan.length,
              on: theo === 'cong_doan',
              onClick: () => doiTab('cong_doan'),
            },
            {
              key: 'to',
              label: 'Theo tổ',
              n: p.to_xuong.length,
              on: theo === 'to',
              onClick: () => doiTab('to'),
            },
            {
              key: 'nguoi',
              label: 'Theo người',
              on: false,
              onClick: () => {},
              off: 'Giờ công ghi theo tổ ở đầu phiếu (số CN × giờ) — chưa có giờ theo từng người',
            },
          ]}
        />

        {p.chua_tinh > 0 && (
          <div className="sx-note">
            <b>{p.chua_tinh}</b> phiếu trong kỳ chưa xác nhận — chưa tính vào năng suất
            <Link className="lnk" href={`/thongke/ngay?date=${p.to}`}>
              Sổ ngày &amp; chốt sổ
            </Link>
          </div>
        )}
        {missingKg > 0 && (
          <div className="sx-note">
            <b>{missingKg}</b> dòng sổ trong kỳ không có kg (chi tiết chưa có ĐM kg) —
            năng suất kg chưa gồm chúng, số lượng thì đủ
          </div>
        )}
        {noHours > 0 && (
          <div className="sx-note">
            <b>{noHours}</b> phiếu không ghi giờ công — vào kg, không vào năng suất
          </div>
        )}
        {p.co_so && !p.co_dm && (
          <div className="sx-note ok">
            Chưa công đoạn nào đặt ĐM năng suất — cột % ĐM tắt
            <Link className="lnk" href="/production/cau-hinh/cong-doan">
              Đặt ở Cấu hình công đoạn
            </Link>
          </div>
        )}

        {!p.co_so ? (
          <Rong
            tieuDe="Chưa có phiếu ghi sổ nào được xác nhận"
            lyDo="Năng suất tính từ phiếu Ghi sản lượng đã được tổ trưởng xác nhận, có giờ công ở đầu phiếu (số công nhân × giờ mỗi người). ERP chưa có phiếu nào như thế."
            tiep={
              <Link className="lnk" href="/thongke/ghi">
                Mở Ghi sản lượng
              </Link>
            }
          />
        ) : (
          <div className="sx-grid">
            <BangTom p={p} rows={rows} theo={theo} kyHref={kyHref} />
            <BangNgay p={p} rows={rows} theo={theo} />
          </div>
        )}

        <ThanhTT
          left="Giờ công lấy từ đầu phiếu ghi sổ (tổ × ngày × ca × công đoạn) · chỉ phiếu đã xác nhận"
          right="Năng suất = Σ kg ÷ Σ giờ công"
        />
      </div>
    </SxKhung>
  )
}

/** Bảng tóm theo công đoạn / tổ — như khối W–Z của sheet "Năng suất". */
function BangTom({
  p,
  rows,
  theo,
  kyHref,
}: {
  p: NangSuatPayload
  rows: NangSuatHang[]
  theo: Theo
  kyHref: (k: number) => string
}) {
  const coDm = p.co_dm
  const nCols = coDm ? 9 : 7
  return (
    <table className="sx-tb" style={{ minWidth: coDm ? 900 : 780 }}>
      <colgroup>
        <col style={{ width: 130 }} />
        <col style={{ width: 160 }} />
        <col style={{ width: 96 }} />
        <col style={{ width: 104 }} />
        <col style={{ width: 82 }} />
        <col style={{ width: 104 }} />
        {coDm && <col style={{ width: 64 }} />}
        {coDm && <col style={{ width: 64 }} />}
        <col />
      </colgroup>
      <thead>
        <tr>
          <th>{theo === 'to' ? 'Tổ' : 'Công đoạn'}</th>
          <th>{theo === 'to' ? 'Công đoạn' : 'Tổ'}</th>
          <th className="r">
            Sản lượng<span className="u">kg</span>
          </th>
          <th className="r" title="Số đạt — mỗi công đoạn một đơn vị đếm, không cộng dọc">
            Số lượng<span className="u">theo đơn vị đếm</span>
          </th>
          <th className="r">Giờ công</th>
          <th className="r">
            Năng suất<span className="u">kg / giờ-người</span>
          </th>
          {coDm && <th className="r">ĐM</th>}
          {coDm && <th className="r">% ĐM</th>}
          <th>
            {p.ky} ngày
            <span className="u">
              năng suất mỗi ngày{coDm ? ' · cam = dưới 80% ĐM' : ''}
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const tile = soDinhMuc(r.ns, r.dm_ns)
          return (
            <tr key={r.key || '-'} className="d">
              <td>
                <b>{r.label}</b>
              </td>
              <td className="mut" title={r.sub ?? undefined}>
                {r.sub ?? '—'}
              </td>
              {r.docs === 0 ? (
                <td colSpan={nCols - 2} className="mut">
                  Không phiếu nào trong kỳ
                  {r.last_date && <> — lần ghi cuối {dmy(r.last_date)}</>}
                  {p.ky < 30 && (
                    <>
                      {' '}
                      <Link className="lnk" href={kyHref(30)}>
                        Xem 30 ngày
                      </Link>
                    </>
                  )}
                </td>
              ) : (
                <>
                  <td className="r num">{fmt0(r.kg)}</td>
                  <td className="r num">
                    {fmt0(r.qty)}
                    {r.count_level && (
                      <span className="mut"> {COUNT_LEVEL_LABEL[r.count_level]}</span>
                    )}
                  </td>
                  <td className="r num">{fmt(r.hours)}</td>
                  <td
                    className="r num"
                    title={
                      r.ns != null
                        ? `${fmt(r.kg_ns)} kg ÷ ${fmt(r.hours)} giờ`
                        : 'Chưa có giờ công — không tính được'
                    }
                  >
                    <b>{r.ns != null ? fmt(r.ns) : '—'}</b>
                  </td>
                  {coDm && (
                    <td className="r num mut">{r.dm_ns != null ? fmt(r.dm_ns) : ''}</td>
                  )}
                  {coDm && (
                    <td
                      className={cx(
                        'r num',
                        tile != null && tile < NGUONG_THAP && 'warn',
                        tile != null && tile >= 1 && 'ok',
                      )}
                    >
                      {tile != null ? pct(tile) : ''}
                    </td>
                  )}
                  <td>
                    <Nhip days={p.days} by={r.by_day} dmNs={r.dm_ns} />
                  </td>
                </>
              )}
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr>
          <td>Toàn xưởng</td>
          <td />
          <td className="r num">{fmt0(p.total.kg)}</td>
          <td
            className="r mut"
            title="Chi tiết, cụm, bộ là ba đơn vị — cộng dọc vô nghĩa"
          >
            không cộng
          </td>
          <td className="r num">{fmt(p.total.hours)}</td>
          <td className="r num">{p.total.ns != null ? fmt(p.total.ns) : '—'}</td>
          {coDm && <td />}
          {coDm && <td />}
          <td className="mut" style={{ fontWeight: 400 }}>
            = Σ kg ÷ Σ giờ công, không lấy trung bình các dòng
          </td>
        </tr>
      </tfoot>
    </table>
  )
}

/** Dải năng suất mỗi ngày — cột cao theo năng suất, cam khi dưới 80% ĐM. */
function Nhip({ days, by, dmNs }: { days: string[]; by: NsO[]; dmNs: number | null }) {
  const max = Math.max(1, ...by.map((x) => x.ns ?? 0))
  return (
    <span className="sx-d14 ns">
      {by.map((x, i) => {
        const thap = x.ns != null && dmNs != null && x.ns < dmNs * NGUONG_THAP
        return (
          <i
            key={days[i]}
            className={cx(x.ns == null && 'z', thap && 'lo') || undefined}
            style={{
              height: x.ns != null ? Math.max(2, Math.round((x.ns / max) * 16)) : 1,
            }}
            title={
              x.ns != null
                ? `${dm(days[i])}: ${fmt(x.ns)} kg/giờ-người`
                : x.docs > 0
                  ? `${dm(days[i])}: ${fmt0(x.kg)} kg, không giờ công`
                  : `${dm(days[i])}: không phiếu`
            }
          />
        )
      })}
    </span>
  )
}

/** Bảng chéo (công đoạn | tổ) × ngày — ô là năng suất của ngày, bấm ra sổ ngày đó. */
function BangNgay({
  p,
  rows,
  theo,
}: {
  p: NangSuatPayload
  rows: NangSuatHang[]
  theo: Theo
}) {
  const coSo = rows.filter((r) => r.docs > 0)
  const wCell = p.days.length > 14 ? 44 : 58
  return (
    <>
      <div className="sx-mh">
        {theo === 'to' ? 'Tổ' : 'Công đoạn'} × ngày
        <span
          className="mut"
          style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}
        >
          kg / giờ-người{p.co_dm ? ' · nền cam = dưới 80% ĐM · xanh = đạt ĐM' : ''} · bấm
          ô ra sổ ngày đó
        </span>
      </div>
      <table
        className="sx-tb sx-nsd"
        style={{ minWidth: 130 + p.days.length * wCell + 70 }}
      >
        <colgroup>
          <col style={{ width: 130 }} />
          {p.days.map((d) => (
            <col key={d} style={{ width: wCell }} />
          ))}
          <col style={{ width: 70 }} />
        </colgroup>
        <thead>
          <tr>
            <th>{theo === 'to' ? 'Tổ' : 'Công đoạn'}</th>
            {p.days.map((d) => (
              <th
                key={d}
                className={cx('r', new Date(`${d}T00:00:00Z`).getUTCDay() === 0 && 'cn')}
              >
                {dm(d)}
              </th>
            ))}
            <th className="r">Kỳ</th>
          </tr>
        </thead>
        <tbody>
          {coSo.map((r) => (
            <tr key={r.key || '-'} className="d">
              <td>
                <b>{r.label}</b>
              </td>
              {r.by_day.map((x, i) => {
                const tile = soDinhMuc(x.ns, r.dm_ns)
                const d = p.days[i]
                if (x.docs === 0)
                  return (
                    <td key={d} className="r empty">
                      ·
                    </td>
                  )
                return (
                  <td
                    key={d}
                    className={cx(
                      'r num',
                      tile != null && tile < NGUONG_THAP && 'thap',
                      tile != null && tile >= 1 && 'dat',
                    )}
                  >
                    <Link
                      href={`/thongke/ngay?date=${d}`}
                      title={
                        x.ns != null
                          ? `${fmt(x.kg_ns)} kg ÷ ${fmt(x.hours)} giờ · ${x.docs} phiếu`
                          : `${fmt0(x.kg)} kg · ${x.docs} phiếu không ghi giờ công`
                      }
                    >
                      {x.ns != null ? fmt(x.ns) : '–'}
                    </Link>
                  </td>
                )
              })}
              <td className="r num">
                <b>{r.ns != null ? fmt(r.ns) : '—'}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
