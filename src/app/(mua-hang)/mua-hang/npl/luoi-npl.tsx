'use client'

import Link from 'next/link'
import { ngayQua, tenGoi, type NplNhom, type NplRow } from '@/lib/npl-theo-lenh'
import { PO_STATUS_LABEL, type PoStatus } from '@/lib/po-status'
import { cotTheoTab, ngayDu, ngayNgan, soVn, TAB_XEM, type Cot } from './npl.shared'
import type { NplCtx } from './useNpl'

/**
 * Lưới NPL gom theo lệnh — đầu cột dính, chân tổng dính, mỗi dòng một hàng.
 * Cột đổi theo tab + phạm vi (`cotTheoTab`, bản vẽ 2 · Q3).
 */
export function LuoiNpl({ d, today }: { d: NplCtx; today: string }) {
  const cot = cotTheoTab(d.tab, d.phong)
  const soDon = new Set(d.xem.map((r) => r.po_id)).size
  const tre = d.xem.filter((r) => r.tre).length
  return (
    <div className="npl-gw">
      <table className="npl-g">
        <colgroup>
          {cot.map((c) => (
            <col key={c.key} style={c.w ? { width: c.w } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {cot.map((c) => (
              <th key={c.key} className={c.r ? 'r' : undefined}>
                {c.key === 'gut' ? <span className="sr">Mở chi tiết</span> : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.nhom.length === 0 ? (
            <Rong d={d} soCot={cot.length} />
          ) : (
            d.nhom.map((g) => (
              <Nhom key={g.lenh.id} g={g} d={d} cot={cot} today={today} />
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={cot.length}>
              {soVn(d.xem.length)} dòng · {d.nhom.length} lệnh · {soDon} đơn
              {tre > 0 && <span className="late"> · {tre} trễ hẹn</span>}
              <span className="sub">không cộng số lượng: mỗi mã một ĐVT</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function Rong({ d, soCot }: { d: NplCtx; soCot: number }) {
  const tenTab = TAB_XEM.find((t) => t.key === d.tab)?.label ?? ''
  const lenh = d.loc.lsx ? d.chonLoc.lenh.find((l) => l.id === d.loc.lsx)?.code : null
  // Chỉ sang đúng chỗ đang có dòng, không bắt người dùng đoán.
  const khac = TAB_XEM.find(
    (t) => t.key !== d.tab && t.key !== 'tat_ca' && d.dem[t.key] > 0,
  )
  const phong = !d.phong ? d.demPhong[d.tab] : 0
  return (
    <tr className="empty">
      <td colSpan={soCot}>
        {lenh
          ? `Lệnh ${lenh} không có dòng nào ở tab ${tenTab}`
          : !d.phong
            ? `Bạn không có dòng nào ở tab ${tenTab}${d.coLoc ? ' khớp bộ lọc' : ''}`
            : `Tab ${tenTab}: không có dòng nào${d.coLoc ? ' khớp bộ lọc' : ''}`}
        {khac && (
          <>
            {' · '}
            <button type="button" className="lnk" onClick={() => d.setTab(khac.key)}>
              Xem tab {khac.label} ({soVn(d.dem[khac.key])})
            </button>
          </>
        )}
        {phong > 0 && (
          <>
            {' · '}
            <button type="button" className="lnk" onClick={() => d.setPhamVi('phong')}>
              Xem cả phòng ({soVn(phong)})
            </button>
          </>
        )}
        {d.coLoc && (
          <>
            {' · '}
            <button type="button" className="lnk" onClick={d.boLoc}>
              Bỏ lọc
            </button>
          </>
        )}
      </td>
    </tr>
  )
}

function Nhom({
  g,
  d,
  cot,
  today,
}: {
  g: NplNhom
  d: NplCtx
  cot: Cot[]
  today: string
}) {
  const mo = !d.gap.has(g.lenh.id)
  const ship = g.lenh.ship_date
  const con = ship ? -ngayQua(ship, today) : null
  return (
    <>
      <tr className="grp">
        <td colSpan={cot.length}>
          <button
            type="button"
            className="tg"
            aria-expanded={mo}
            aria-label={`${mo ? 'Gập' : 'Mở'} lệnh ${g.lenh.code}`}
            onClick={() => d.latGap(g.lenh.id)}
          >
            <span aria-hidden="true">{mo ? '▾' : '▸'}</span>
          </button>
          <Link className="lsx" href={`/mua-hang/yeu-cau/${g.lenh.id}`}>
            {g.lenh.code}
          </Link>
          <span className="meta">
            {ship ? (
              <>
                xuất <b>{ngayDu(ship)}</b> ·{' '}
                <span className={con! < 0 ? 'past' : con! <= 14 ? 'soon' : ''}>
                  {con! < 0 ? `đã qua ${-con!} ngày` : `còn ${con} ngày`}
                </span>
              </>
            ) : (
              'chưa có ngày xuất'
            )}
          </span>
          <span className="meta">
            <b>{soVn(g.rows.length)}</b> dòng
          </span>
          {g.tre > 0 && <span className="tre">{g.tre} trễ</span>}
        </td>
      </tr>
      {mo && g.rows.map((r) => <Dong key={r.key} r={r} d={d} cot={cot} today={today} />)}
    </>
  )
}

function Dong({ r, d, cot, today }: { r: NplRow; d: NplCtx; cot: Cot[]; today: string }) {
  const coChiTiet = !!(r.chia || r.gop)
  const mo = coChiTiet && d.moChia.has(r.key)
  const chuaVe = r.tab === 'chua_dat' || r.tab === 'cho_ncc'
  return (
    <>
      <tr
        className={d.chon === r.key ? 'd sel' : 'd'}
        onClick={() => {
          d.setChon(r.key)
          if (coChiTiet) d.latChia(r.key)
        }}
      >
        {cot.map((c) => (
          <O key={c.key} c={c} r={r} mo={mo} chuaVe={chuaVe} d={d} today={today} />
        ))}
      </tr>
      {mo && (
        <tr className="det">
          <td colSpan={cot.length}>
            <ChiTiet r={r} />
          </td>
        </tr>
      )}
    </>
  )
}

/** Một ô theo khoá cột. */
function O({
  c,
  r,
  mo,
  chuaVe,
  d,
  today,
}: {
  c: Cot
  r: NplRow
  mo: boolean
  chuaVe: boolean
  d: NplCtx
  today: string
}) {
  switch (c.key) {
    case 'gut':
      return (
        <td className="gut">
          {(r.chia || r.gop) && (
            <button
              type="button"
              aria-expanded={mo}
              aria-label={r.chia ? `Dòng chia ${r.chia.parts.length} lệnh` : 'Đơn gộp'}
              title={
                r.chia
                  ? `Dòng ${r.po_code} chia ${r.chia.parts.length} lệnh — bấm để xem từng phần`
                  : `${r.po_code} gộp nhiều lệnh — bấm để xem`
              }
              onClick={(e) => {
                e.stopPropagation()
                d.setChon(r.key)
                d.latChia(r.key)
              }}
            >
              {mo ? '▾' : '▸'}
            </button>
          )}
        </td>
      )
    case 'ma':
      return (
        <td title={r.ma}>
          {r.material_id ? (
            <Link className="ma" href={`/mua-hang/vat-tu/${r.material_id}`}>
              {r.ma}
            </Link>
          ) : (
            <span className="mut">{r.ma}</span>
          )}
        </td>
      )
    case 'ten':
      return <td title={r.ten}>{r.ten}</td>
    case 'dvt':
      return <td className="mut">{r.dvt}</td>
    case 'sl':
    case 'dat':
      return <td className="r">{soVn(r.dat)}</td>
    case 've':
      return (
        <td className="r">
          {chuaVe ? (
            <span className="em">—</span>
          ) : r.ve > 0 ? (
            soVn(r.ve)
          ) : (
            <span className="em">0</span>
          )}
        </td>
      )
    case 'thieu':
      return (
        <td className="r">
          {r.thieu > 0 ? soVn(r.thieu) : <span className="em">0</span>}
        </td>
      )
    case 'don':
      return (
        <td>
          <Link className="po" href={`/mua-hang/don/${r.po_id}`}>
            {r.po_code}
          </Link>
        </td>
      )
    case 'ncc':
      return <td title={r.supplier}>{r.supplier}</td>
    case 'nguoi':
      return (
        <td className="mut" title={r.assignee ?? ''}>
          {tenGoi(r.assignee)}
        </td>
      )
    case 'hen':
      return <Hen r={r} chuaVe={chuaVe} today={today} />
    case 'tt':
      return (
        <td>
          <TinhTrang r={r} />
        </td>
      )
  }
}

/**
 * Hẹn về (bản 2 · Q2): đơn nháp / chờ NCC chữ xám — hẹn đó mới là dự tính;
 * dòng đang về đã qua hẹn thêm "trễ N" đỏ ngay trong ô.
 */
function Hen({ r, chuaVe, today }: { r: NplRow; chuaVe: boolean; today: string }) {
  if (!r.hen)
    return (
      <td>
        <span className="em">—</span>
      </td>
    )
  return (
    <td title={ngayDu(r.hen)}>
      <span className={chuaVe ? 'hen plan' : 'hen'}>{ngayNgan(r.hen, today)}</span>
      {r.tre && <span className="late"> trễ {r.tre}</span>}
    </td>
  )
}

/** Chi tiết dòng chia nhiều lệnh, hoặc lời giải thích đơn gộp. */
function ChiTiet({ r }: { r: NplRow }) {
  if (!r.chia)
    return (
      <>
        <span className="mono">{r.po_code}</span> gộp {r.lsx_code} + {r.gop?.join(' + ')}.
        Dòng chưa chia số lượng theo lệnh nên tính hết vào lệnh chính {r.lsx_code}.
      </>
    )
  return (
    <>
      Dòng <span className="mono">{r.po_code}</span> đặt {soVn(r.chia.po_line_qty)}{' '}
      {r.dvt}, đã về {soVn(r.chia.received)}, chia {r.chia.parts.length} lệnh. Hàng về
      chia cho lệnh xuất trước (cùng ngày xuất thì theo số lệnh):
      <table className="npl-det">
        <thead>
          <tr>
            <th>Lệnh</th>
            <th>Xuất</th>
            <th className="r">Phần chia</th>
            <th className="r">Nhận</th>
            <th className="r">Còn thiếu</th>
          </tr>
        </thead>
        <tbody>
          {r.chia.parts.map((p) => (
            <tr key={p.lsx_code}>
              <td className="mono">{p.lsx_code}</td>
              <td className="mono">{p.ship_date ? ngayDu(p.ship_date) : '—'}</td>
              <td className="mono r">{soVn(p.qty)}</td>
              <td className="mono r">{soVn(p.nhan)}</td>
              <td className={p.thieu > 0 ? 'mono r late' : 'mono r'}>{soVn(p.thieu)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/** Chữ tình trạng: nhãn đơn theo vòng đời — màu chữ, không nền. */
function TinhTrang({ r }: { r: NplRow }) {
  if (r.tab === 'du') return <span className="st-d">Về đủ</span>
  const nhan = PO_STATUS_LABEL[r.status as PoStatus] ?? r.status
  const cls =
    r.status === 'draft'
      ? 'st-n'
      : r.tab === 'chua_dat' || r.tab === 'cho_ncc'
        ? 'st-c'
        : r.status === 'partial'
          ? 'st-p'
          : 'st-g'
  return <span className={cls}>{nhan}</span>
}
