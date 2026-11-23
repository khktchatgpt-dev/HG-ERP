'use client'

import './theo-lenh.css'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, FolderOpen } from 'lucide-react'
import { isoToVn } from '@/lib/date-vn'
import {
  KD_RO,
  type KdDonLenh,
  type KdLenhTong,
  type KdRo,
} from '@/lib/kho-don-theo-lenh'
import { searchMatcher } from '@/lib/search-text'
import { useBeRong } from '@/lib/use-be-rong'
import {
  ApNhom,
  ApNut,
  DauTrang,
  KhoKhung,
  Rong,
  So,
  TabNgang,
  ThanhLoc,
  ThanhTT,
} from '../../_erp/khung'
import { lenhHref, URL_THEO_LENH as URL_GOC } from './theo-lenh.shared'

const RO_NHAN: Record<KdRo, string> = {
  cho: 'Còn chờ hàng',
  tre: 'Có đơn trễ',
  du: 'Đã về đủ',
  all: 'Tất cả',
}
const RO_RONG: Record<KdRo, string> = {
  cho: 'Mọi đơn đã đặt của các lệnh đang chạy đều đã về đủ.',
  tre: 'Không đơn nào NCC đã xác nhận mà quá hẹn về.',
  du: 'Chưa lệnh nào về đủ mọi đơn — lệnh còn đơn chờ hàng hoặc còn đơn chưa đặt.',
  all: 'Không có lệnh nào đang chạy (đã duyệt / đang sản xuất).',
}

/**
 * KHO › NHẬN HÀNG › THEO LỆNH — tầng ① (bản vẽ 2,
 * https://claude.ai/artifact/69uVsoeKimjmBMCiXD9Tsp, Q7–Q9 duyệt 23/11/2026).
 *
 * CHỈ một bảng lệnh — không mở gì dưới dòng (chủ dự án: "gộp 1 trang duy nhất,
 * khó dùng"). Bấm mã lệnh / Enter / bấm đúp → trang một lệnh. Bấm dòng = chọn,
 * Action Pane thành "Mở lệnh …". Mọi số đếm từ `lib/kho-don-theo-lenh` (có test).
 */
export function DonTheoLenhScreen({
  lenh,
  rows,
  ro: roDau,
  chon: chonDau,
  today,
}: {
  lenh: KdLenhTong[]
  rows: KdDonLenh[]
  ro: KdRo
  /** Lệnh vừa xem (quay lại từ trang lệnh) — chọn sẵn + cuộn tới. */
  chon: string | null
  /** Ngày VN (YYYY-MM-DD) từ server — client không đọc đồng hồ. */
  today: string
}) {
  const router = useRouter()
  const [ro, setRo] = useState<KdRo>(roDau)
  const [q, setQ] = useState('')
  const [chon, setChon] = useState<string | null>(chonDau)
  const khung = useRef<HTMLDivElement>(null)
  const beRong = useBeRong(khung)
  const hep = beRong > 0 && beRong < 900
  const gon = beRong > 0 && beRong < 1180

  useEffect(() => {
    if (!chonDau) return
    document.getElementById(`lenh-${chonDau}`)?.scrollIntoView({ block: 'center' })
  }, [chonDau])

  const timTheoLenh = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const r of rows)
      m.set(r.lsx_id, [...(m.get(r.lsx_id) ?? []), r.po_code, r.supplier])
    return m
  }, [rows])

  const ghiUrl = (r: KdRo, c: string | null) => {
    const s = new URLSearchParams()
    if (r !== 'cho') s.set('ro', r)
    if (c) s.set('chon', c)
    const qs = s.toString()
    window.history.replaceState(null, '', qs ? `${URL_GOC}?${qs}` : URL_GOC)
  }
  const chonRo = (r: KdRo) => {
    setRo(r)
    ghiUrl(r, chon)
  }
  const chonLenh = (id: string) => {
    setChon(id)
    ghiUrl(ro, id)
  }
  const phim = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      router.push(lenhHref(id))
    } else if (e.key === ' ') {
      e.preventDefault()
      chonLenh(id)
    }
  }

  // Tìm cả số đơn + NCC trong lệnh: "Kimpack" ra các lệnh có đơn Kimpack.
  const khop = searchMatcher(q)
  const theoTim = lenh.filter((l) =>
    khop([l.code, l.khach ?? '', ...(timTheoLenh.get(l.id) ?? [])]),
  )
  const dem = Object.fromEntries(
    KD_RO.map((r) => [r, theoTim.filter((l) => l.ro[r]).length]),
  ) as Record<KdRo, number>
  const ds = theoTim.filter((l) => l.ro[ro])
  const cong = ds.reduce(
    (a, l) => ({
      don: a.don + l.don,
      du: a.du + l.du,
      mot_phan: a.mot_phan + l.mot_phan,
      chua_ve: a.chua_ve + l.chua_ve,
      chua_dat: a.chua_dat + l.chua_dat,
      tre: a.tre + l.tre,
    }),
    { don: 0, du: 0, mot_phan: 0, chua_ve: 0, chua_dat: 0, tre: 0 },
  )
  const tongCho = lenh.filter((l) => l.ro.cho).length
  const tongTre = lenh.reduce((s, l) => s + l.tre, 0)
  const lenhChon = ds.find((l) => l.id === chon) ?? null
  // Rổ khác còn lệnh khớp tìm → gợi ý chuyển rổ ở trạng thái rỗng.
  const roKhac = KD_RO.find((r) => r !== ro && r !== 'all' && dem[r] > 0) ?? 'all'

  return (
    <KhoKhung label="Đơn mua theo lệnh">
      <DauTrang
        title="Nhận hàng"
        ctx={
          <>
            <b>{lenh.length}</b> lệnh đang chạy · <b>{tongCho}</b> lệnh còn chờ hàng
            {tongTre > 0 && (
              <>
                {' '}
                · <b className="kh-stop">{tongTre}</b> đơn trễ hẹn
              </>
            )}
          </>
        }
        actions={
          <>
            <ApNhom>
              <ApNut
                primary
                icon={<FolderOpen size={15} aria-hidden />}
                href={lenhChon ? lenhHref(lenhChon.id) : undefined}
                why={lenhChon ? null : 'Chọn một lệnh trong bảng trước'}
              >
                {lenhChon ? `Mở lệnh ${lenhChon.code}` : 'Mở lệnh'}
              </ApNut>
            </ApNhom>
            <ApNhom>
              <ApNut
                icon={<BookOpen size={15} aria-hidden />}
                href="/warehouse/phieu?ro=receipt"
              >
                Phiếu đã ghi
              </ApNut>
            </ApNhom>
          </>
        }
      />

      <TabNgang
        label="Cách xem hàng về"
        tabs={[
          {
            key: 'don',
            label: 'Đơn đang về',
            on: false,
            href: '/warehouse/nhap',
            mau: 'c-nhap',
          },
          { key: 'lenh', label: 'Theo lệnh', on: true, n: lenh.length, mau: 'c-nhap' },
        ]}
      />

      <ThanhLoc>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm lệnh, khách, số đơn, NCC…"
          aria-label="Tìm lệnh, khách, số đơn, NCC"
        />
        <div className="kh-seg" role="radiogroup" aria-label="Rổ lệnh">
          {KD_RO.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={ro === r}
              onClick={() => chonRo(r)}
            >
              {RO_NHAN[r]} <span className="kh-num">{dem[r]}</span>
            </button>
          ))}
        </div>
        {q.trim() && (
          <button type="button" className="clr" onClick={() => setQ('')}>
            Bỏ tìm
          </button>
        )}
        {!hep && (
          <span className="sp kh-mut">Xếp theo ngày xuất hàng, gần nhất trước</span>
        )}
      </ThanhLoc>

      <div ref={khung} style={{ height: 0, width: '100%' }} aria-hidden />
      {ds.length === 0 ? (
        <Rong
          tieuDe={
            q.trim()
              ? `Không lệnh nào khớp “${q.trim()}” trong rổ ${RO_NHAN[ro]}`
              : `Không có lệnh nào trong rổ ${RO_NHAN[ro]}`
          }
          lyDo={
            q.trim()
              ? dem[roKhac] > 0
                ? `Có ${dem[roKhac]} lệnh khớp ở rổ ${RO_NHAN[roKhac]}.`
                : 'Không lệnh đang chạy nào có lệnh, khách, số đơn hay NCC khớp từ khoá.'
              : RO_RONG[ro]
          }
          tiep={
            <button
              type="button"
              className="kh-btn"
              onClick={() =>
                q.trim() && dem[roKhac] > 0 ? chonRo(roKhac) : (setQ(''), chonRo('all'))
              }
            >
              {q.trim() && dem[roKhac] > 0
                ? `Xem ở rổ ${RO_NHAN[roKhac]} · ${dem[roKhac]} lệnh`
                : 'Xem tất cả lệnh'}
            </button>
          }
        />
      ) : (
        <div className="kh-grid">
          <table className="kh-tb" aria-label="Lệnh đang chạy và đơn mua">
            <colgroup>
              <col />
              {!gon && <col style={{ width: 160 }} />}
              <col style={{ width: 96 }} />
              <col style={{ width: 60 }} />
              <col style={{ width: 66 }} />
              {!hep && <col style={{ width: 86 }} />}
              <col style={{ width: 76 }} />
              {!hep && <col style={{ width: 86 }} />}
              <col style={{ width: 72 }} />
              {!hep && <col style={{ width: 160 }} />}
            </colgroup>
            <thead>
              <tr>
                <th>Lệnh</th>
                {!gon && <th>Khách</th>}
                <th className="r">Xuất hàng</th>
                <th className="r" title="Đơn đang hiệu lực, không gồm đơn huỷ">
                  Đơn
                </th>
                <th className="r">Về đủ</th>
                {!hep && <th className="r">Một phần</th>}
                <th className="r">Chưa về</th>
                {!hep && (
                  <th className="r" title="Đơn nháp / chờ duyệt — chỉ để biết">
                    Chưa đặt
                  </th>
                )}
                <th className="r" title="Đơn NCC đã xác nhận, còn chờ hàng, quá hẹn về">
                  Trễ hẹn
                </th>
                {!hep && <th title="Đơn về đủ / đơn đã đặt">Đã nhận</th>}
              </tr>
            </thead>
            <tbody>
              {ds.map((l) => {
                const on = l.id === chon
                const daDat = l.don - l.chua_dat
                const pDu = daDat > 0 ? (l.du / daDat) * 100 : 0
                const pMp = daDat > 0 ? (l.mot_phan / daDat) * 100 : 0
                return (
                  <tr
                    key={l.id}
                    id={`lenh-${l.id}`}
                    className={on ? 'd on' : 'd'}
                    tabIndex={0}
                    aria-selected={on}
                    onClick={() => chonLenh(l.id)}
                    onDoubleClick={() => router.push(lenhHref(l.id))}
                    onKeyDown={(e) => phim(e, l.id)}
                  >
                    <td title={l.khach ? `${l.code} · ${l.khach}` : l.code}>
                      <Link
                        href={lenhHref(l.id)}
                        className="kh-ma kd-lnk"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {l.code}
                      </Link>
                      {gon && l.khach && (
                        <span
                          className="kh-mut"
                          style={{ display: 'block', fontSize: 11.5 }}
                        >
                          {l.khach}
                        </span>
                      )}
                    </td>
                    {!gon && (
                      <td className="kh-mut" title={l.khach ?? ''}>
                        {l.khach ?? '—'}
                      </td>
                    )}
                    <td className="r kh-num">
                      {l.ship_date ? (
                        isoToVn(l.ship_date)
                      ) : (
                        <span className="kh-empty">—</span>
                      )}
                    </td>
                    <td className="r kh-num kh-b">
                      <So n={l.don} />
                    </td>
                    <td className="r kh-num">
                      <So n={l.du} tone="ok" />
                    </td>
                    {!hep && (
                      <td className="r kh-num">
                        <So n={l.mot_phan} tone="warn" />
                      </td>
                    )}
                    <td className="r kh-num">
                      <So n={l.chua_ve} />
                      {hep && l.mot_phan > 0 && (
                        <span className="kh-warn"> +{l.mot_phan}</span>
                      )}
                    </td>
                    {!hep && (
                      <td className="r kh-num kh-mut">
                        <So n={l.chua_dat} />
                      </td>
                    )}
                    <td className="r kh-num">
                      <So n={l.tre} tone="stop" />
                    </td>
                    {!hep && (
                      <td>
                        {daDat > 0 ? (
                          <>
                            <span className="kd-bar" aria-hidden>
                              <i style={{ width: `${pDu}%` }} />
                              <b style={{ left: `${pDu}%`, width: `${pMp}%` }} />
                            </span>
                            <span className="kh-num">
                              {l.du}/{daDat}
                            </span>
                          </>
                        ) : (
                          <span className="kh-empty">chưa đặt đơn nào</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={gon ? 2 : 3}>
                  {ds.length} lệnh · không gồm đơn huỷ · đơn gộp đếm ở mọi lệnh nó phục vụ
                </td>
                <td className="r">{cong.don}</td>
                <td className="r">{cong.du}</td>
                {!hep && <td className="r">{cong.mot_phan}</td>}
                <td className="r">{cong.chua_ve}</td>
                {!hep && <td className="r">{cong.chua_dat}</td>}
                <td className="r">{cong.tre}</td>
                {!hep && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ThanhTT
        left={
          <>
            Bấm mã lệnh hoặc Enter để mở trang lệnh · Về đủ = mọi dòng đã nhận đủ hoặc
            Cung ứng đã chốt thiếu · {today && `số tính tới ${isoToVn(today)}`}
          </>
        }
        right={
          <b>
            {ds.length} / {lenh.length} lệnh
          </b>
        }
      />
    </KhoKhung>
  )
}
