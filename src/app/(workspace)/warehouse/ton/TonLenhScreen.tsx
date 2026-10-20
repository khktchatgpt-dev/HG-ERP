'use client'

import { Fragment, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowUpFromLine, BookOpen } from 'lucide-react'
import { isoToVn } from '@/lib/date-vn'
import { RO_LENH, type RoLenh } from '@/lib/kho-ton-lenh'
import { searchMatcher } from '@/lib/search-text'
import { useBeRong } from '@/lib/use-be-rong'
import {
  ApNhom,
  ApNut,
  DauTrang,
  KhoKhung,
  ODem,
  Rong,
  So,
  TabNgang,
  ThanhLoc,
  ThanhTT,
} from '../_erp/khung'
import { LenhChiTiet } from './lenh-chi-tiet'
import type { LenhDong, MaChiTiet } from './ton-lenh.shared'

const RO_NHAN: Record<RoLenh, string> = {
  con: 'Kho còn hàng của lệnh',
  han: 'Quá hạn · ≤ 7 ngày',
  xong: 'Lệnh xong chưa ghi xuất',
  all: 'Tất cả',
}
const RO_KHAI: Record<RoLenh, { s: string; mau: string }> = {
  con: { s: 'tổ chưa lấy hết', mau: 'c-xuat' },
  han: { s: 'hạn xuất hàng gần / đã qua', mau: 'c-stop' },
  xong: { s: 'sổ còn sót, kho đã hết', mau: 'c-mut' },
  all: { s: 'lệnh đã có hàng về', mau: 'c-mut' },
}

/** Số ngày từ hôm nay tới hạn (âm = đã qua). */
const conNgay = (ship: string, today: string) =>
  Math.round(
    (Date.parse(`${ship}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  )

function Han({ l, today }: { l: LenhDong; today: string }) {
  if (!l.ship_date) return <span className="kh-empty">chưa có</span>
  const n = conNgay(l.ship_date, today)
  return (
    <>
      <span className="kh-num">{isoToVn(l.ship_date)}</span>
      {!l.xong && n < 0 && <span className="kh-stop"> quá {-n} ngày</span>}
      {!l.xong && n >= 0 && n <= 7 && (
        <span className="kh-warn"> {n === 0 ? 'hôm nay' : `còn ${n} ngày`}</span>
      )}
    </>
  )
}

/**
 * TỒN KHO · THEO LỆNH — Kho lối ERP · B1 (khung chung `../_erp/khung.tsx`), nội
 * dung giữ từ Kho đợt 2 · B5 (https://claude.ai/artifact/L2FFuzCdLzMPzQJ7ULUprF).
 *
 * Câu màn trả lời: lệnh nào đang có hàng nằm trong kho mà tổ chưa lấy, lệnh nào
 * sắp / đã quá hạn xuất hàng, lệnh đã xong còn sót gì. Mỗi dòng một lệnh đã có
 * hàng về. Số đếm từ CÙNG hàm với hộp "Lấy hàng của lệnh" ở phiếu xuất.
 *
 * K1: chọn dòng rồi bấm "Xuất cho lệnh" ở Action Pane (không nút trên dòng).
 * K2: ▸ / Enter / bấm đúp mở chi tiết lệnh NGAY DƯỚI DÒNG.
 */
export function TonLenhScreen({
  lenh,
  chiTiet,
  ro: roDau,
  mo: moDau,
  today,
}: {
  lenh: LenhDong[]
  chiTiet: MaChiTiet[]
  ro: RoLenh
  mo: string | null
  /** Ngày VN (YYYY-MM-DD) — từ server, tránh lệch giờ quanh nửa đêm. */
  today: string
}) {
  const [ro, setRo] = useState<RoLenh>(roDau)
  const [q, setQ] = useState('')
  const [mo, setMo] = useState<string | null>(moDau)
  const [chon, setChon] = useState<string | null>(moDau)
  const khung = useRef<HTMLDivElement>(null)
  const beRong = useBeRong(khung)
  const hep = beRong > 0 && beRong < 900
  const gon = beRong > 0 && beRong < 1240

  /** Rổ + lệnh đang mở nằm trên URL: F5 / gửi link giữ đúng chỗ. */
  const ghiUrl = (r: RoLenh, m: string | null) => {
    const s = new URLSearchParams({ xem: 'lenh' })
    if (r !== 'con') s.set('ro', r)
    if (m) s.set('lenh', m)
    window.history.replaceState(null, '', `/warehouse/ton?${s}`)
  }
  const chonRo = (r: RoLenh) => {
    setRo(r)
    ghiUrl(r, mo)
  }
  const doiMo = (id: string) => {
    setChon(id)
    const m = mo === id ? null : id
    setMo(m)
    ghiUrl(ro, m)
  }
  const phim = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      doiMo(id)
    }
  }

  const khop = searchMatcher(q)
  const theoTim = lenh.filter((l) => khop([l.code, l.khach ?? '']))
  const dem = Object.fromEntries(
    RO_LENH.map((r) => [r, theoTim.filter((l) => l.ro[r]).length]),
  ) as Record<RoLenh, number>
  const rows = theoTim.filter((l) => l.ro[ro])
  const cong = rows.reduce(
    (a, l) => ({ con: a.con + l.con_kho, thieu: a.thieu + l.thieu }),
    { con: 0, thieu: 0 },
  )
  const tongCon = lenh.reduce((s, l) => s + l.con_kho, 0)
  const xuatCuoi = lenh.reduce<string | null>(
    (a, l) => (l.xuat_cuoi && (!a || l.xuat_cuoi > a) ? l.xuat_cuoi : a),
    null,
  )
  const theoLenh = useMemo(() => {
    const m = new Map<string, MaChiTiet[]>()
    for (const c of chiTiet) m.set(c.lsx_id, [...(m.get(c.lsx_id) ?? []), c])
    return m
  }, [chiTiet])
  const sel = rows.find((l) => l.id === chon) ?? null
  const xuatDuoc = sel && !sel.xong && sel.con_kho > 0
  const soCot = hep ? 5 : gon ? 9 : 11

  return (
    <KhoKhung label="Tồn kho theo lệnh">
      <DauTrang
        title="Tồn kho"
        ctx={
          <>
            <b>{lenh.length}</b> lệnh có hàng về · <b>{tongCon}</b> mã còn trong kho cho
            lệnh
          </>
        }
        actions={
          <>
            <ApNhom>
              <ApNut
                primary
                icon={<ArrowUpFromLine size={15} aria-hidden />}
                href={xuatDuoc ? `/warehouse/xuat?lsx=${sel.id}` : undefined}
                why={
                  !sel
                    ? 'Chọn một lệnh trong bảng trước'
                    : sel.xong
                      ? 'Lệnh đã xong — không ghi xuất bù (sẽ làm âm tồn)'
                      : sel.con_kho === 0
                        ? 'Kho không còn hàng nào của lệnh này'
                        : null
                }
              >
                {sel ? `Xuất cho ${sel.code}` : 'Xuất cho lệnh'}
              </ApNut>
            </ApNhom>
            <ApNhom>
              <ApNut href="/warehouse/xuat">Lập phiếu xuất</ApNut>
              <ApNut icon={<BookOpen size={15} aria-hidden />} href="/warehouse/phieu">
                Sổ phiếu
              </ApNut>
            </ApNhom>
          </>
        }
      />

      <TabNgang
        label="Xem tồn kho"
        tabs={[
          { key: 'ma', label: 'Theo mã', on: false, href: '/warehouse/ton', mau: 'c-ok' },
          {
            key: 'lenh',
            label: 'Theo lệnh',
            on: true,
            href: '/warehouse/ton?xem=lenh',
            mau: 'c-xuat',
          },
        ]}
      />

      <ThanhLoc>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm lệnh, khách…"
          aria-label="Tìm lệnh, khách"
        />
        {q.trim() && (
          <button type="button" className="clr" onClick={() => setQ('')}>
            Bỏ tìm
          </button>
        )}
      </ThanhLoc>

      <ODem
        label="Rổ lệnh"
        items={RO_LENH.map((r) => ({
          key: r,
          t: RO_NHAN[r],
          n: dem[r],
          s: RO_KHAI[r].s,
          mau: RO_KHAI[r].mau,
          on: ro === r,
          onClick: () => chonRo(r),
        }))}
      />

      {(ro === 'con' || ro === 'han') && tongCon > 0 && (
        <div className="kh-note">
          <span className="tag">Chưa ghi xuất</span>
          <span>
            {xuatCuoi
              ? `Lần ghi xuất cho lệnh gần nhất: ${isoToVn(xuatCuoi)}. `
              : 'Chưa có phiếu xuất cho lệnh nào. '}
            {tongCon} mã dưới đây là hàng đã mua cho lệnh mà sổ chưa ghi giao cho tổ. Tổ
            đã lấy thì ghi xuất để tồn trên máy đúng với kho thật.
          </span>
        </div>
      )}
      {ro === 'xong' && rows.length > 0 && (
        <div className="kh-note mut">
          <span className="tag">Lệnh đã xong</span>
          <span>
            Các lệnh này còn mã sổ chưa ghi xuất, nhưng kho không còn hàng nào của chúng:
            hàng đã vào sản phẩm và kiểm kê 15/09 đã trừ tồn. Ghi xuất bù bây giờ sẽ làm
            âm tồn, nên ở đây không có nút ghi.
          </span>
        </div>
      )}

      <div ref={khung} style={{ height: 0, width: '100%' }} aria-hidden />
      {rows.length === 0 ? (
        <Rong
          tieuDe={`Không có lệnh nào trong rổ "${RO_NHAN[ro]}"`}
          lyDo={
            q.trim()
              ? `Không lệnh nào khớp "${q.trim()}" trong rổ này.`
              : ro === 'xong'
                ? 'Mọi lệnh đã xong đều đã ghi xuất hết hàng đã về.'
                : ro === 'han'
                  ? 'Không lệnh nào quá hạn hoặc tới hạn xuất hàng trong 7 ngày mà kho còn hàng của lệnh.'
                  : 'Kho không còn hàng nào đã mua cho lệnh mà chưa ghi xuất.'
          }
          tiep={
            <button
              type="button"
              className="kh-btn"
              onClick={() => {
                setQ('')
                chonRo('all')
              }}
            >
              Xem tất cả lệnh
            </button>
          }
        />
      ) : (
        <div className="kh-grid">
          <table className="kh-tb" aria-label="Tồn kho theo lệnh">
            <colgroup>
              <col style={{ width: 28 }} />
              <col />
              {!gon && <col style={{ width: 160 }} />}
              {!hep && <col style={{ width: 92 }} />}
              <col style={{ width: hep ? 120 : 172 }} />
              {!hep && <col style={{ width: 70 }} />}
              {!hep && <col style={{ width: 82 }} />}
              <col style={{ width: hep ? 80 : 104 }} />
              {!hep && <col style={{ width: 86 }} />}
              <col style={{ width: 76 }} />
              {!gon && <col style={{ width: 116 }} />}
            </colgroup>
            <thead>
              <tr>
                <th className="c0" aria-label="Mở chi tiết" />
                <th>Lệnh</th>
                {!gon && <th>Khách</th>}
                {!hep && <th>Trạng thái</th>}
                <th>Hạn xuất hàng</th>
                {!hep && (
                  <th className="r" title="Mã đã về">
                    Đã về
                  </th>
                )}
                {!hep && (
                  <th className="r" title="Mã đã xuất đủ">
                    Xuất đủ
                  </th>
                )}
                <th className="r" title="Mã còn trong kho cho lệnh">
                  Còn kho
                </th>
                {!hep && (
                  <th className="r" title="Mã tồn ít hơn phần của lệnh">
                    Thiếu tồn
                  </th>
                )}
                <th className="r" title="Mã kho đã hết">
                  Kho hết
                </th>
                {!gon && <th>Xuất gần nhất</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const on = l.id === chon
                const dangMo = l.id === mo
                return (
                  <Fragment key={l.id}>
                    <tr
                      className={on ? 'd on' : 'd'}
                      tabIndex={0}
                      aria-selected={on}
                      aria-expanded={dangMo}
                      onClick={() => setChon(l.id)}
                      onDoubleClick={() => doiMo(l.id)}
                      onKeyDown={(e) => phim(e, l.id)}
                    >
                      <td className="c0">
                        <button
                          type="button"
                          className="mo"
                          aria-label={`${dangMo ? 'Đóng' : 'Mở'} chi tiết ${l.code}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            doiMo(l.id)
                          }}
                        >
                          {dangMo ? '▾' : '▸'}
                        </button>
                      </td>
                      <td title={l.khach ? `${l.code} · ${l.khach}` : l.code}>
                        <span className="kh-ma">{l.code}</span>
                        {gon && l.khach && (
                          <span
                            className="kh-mut"
                            style={{ display: 'block', fontSize: 11.5 }}
                          >
                            {l.khach}
                            {hep && (l.xong ? ' · đã xong' : ' · đang SX')}
                          </span>
                        )}
                      </td>
                      {!gon && (
                        <td className="kh-mut" title={l.khach ?? ''}>
                          {l.khach ?? '—'}
                        </td>
                      )}
                      {!hep && (
                        <td>
                          <span className={`kh-tag ${l.xong ? 'done' : 'run'}`}>
                            {l.xong ? 'Đã xong' : 'Đang SX'}
                          </span>
                        </td>
                      )}
                      <td>
                        <Han l={l} today={today} />
                      </td>
                      {!hep && (
                        <td className="r kh-num">
                          <So n={l.ma_ve} />
                        </td>
                      )}
                      {!hep && (
                        <td className="r kh-num kh-mut">
                          <So n={l.xuat_du} />
                        </td>
                      )}
                      <td className="r kh-num">
                        <So n={l.con_kho} tone="b" />
                        {hep && l.thieu > 0 && (
                          <span className="kh-warn"> · {l.thieu} thiếu</span>
                        )}
                      </td>
                      {!hep && (
                        <td className="r kh-num">
                          <So n={l.thieu} tone="warn" />
                        </td>
                      )}
                      <td className="r kh-num kh-mut">
                        <So n={l.het} />
                      </td>
                      {!gon && (
                        <td className={l.xuat_cuoi ? 'kh-num kh-mut' : 'kh-empty'}>
                          {l.xuat_cuoi ? isoToVn(l.xuat_cuoi) : 'chưa xuất'}
                        </td>
                      )}
                    </tr>
                    {dangMo && (
                      <tr className="exp">
                        <td colSpan={soCot}>
                          <LenhChiTiet lenh={l} rows={theoLenh.get(l.id) ?? []} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={soCot}>
                  {rows.length} lệnh · {cong.con} mã còn trong kho cho lệnh
                  {cong.thieu > 0 && ` · ${cong.thieu} mã tồn ít hơn phần của lệnh`} ·
                  không gồm lệnh chưa có hàng về
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ThanhTT
        left="Xếp: quá hạn → hạn gần → theo hạn xuất hàng · lệnh đã xong ở cuối · mã chung nhiều lệnh đếm ở lệnh được chia tồn"
        right={
          <b>
            {rows.length} / {lenh.length} lệnh
          </b>
        }
      />
    </KhoKhung>
  )
}
