'use client'

import Link from 'next/link'
import { ngayQua, tenGoi } from '@/lib/npl-theo-lenh'
import type { NplCon } from '@/lib/npl-con-phai-dat'
import { PO_STATUS_LABEL, type PoStatus } from '@/lib/po-status'
import { ngayDu, soVn } from './npl.shared'
import type { NhomCon, NplCtx } from './useNpl'

/**
 * TAB "CÒN PHẢI ĐẶT" (bản vẽ 3, duyệt 21/11/2026 —
 * https://claude.ai/artifact/7pdeBVx9PykFpfZAK8x33K). Mỗi dòng một mã của một
 * lệnh: cần theo định mức (ngũ kim + bao bì) − đã lên đơn của chính lệnh. Bấm dòng
 * mở hai bảng: định mức theo SP và các đơn đã đặt (hoặc dòng gần tên). Dòng cuối
 * kể lệnh chưa so được — rỗng ở tab này dễ bị đọc nhầm là "đủ".
 */
const SO_COT = 9

export function LuoiCon({ d, today }: { d: NplCtx; today: string }) {
  const k = d.can.khongSo
  const lenhLoc = d.loc.lsx
  const ksHien = lenhLoc ? [] : k
  const chuaMa = d.can.chuaMa.NGU_KIM + d.can.chuaMa.PACKAGING
  return (
    <div className="npl-gw">
      <table className="npl-g">
        <colgroup>
          <col style={{ width: 18 }} />
          <col style={{ width: 84 }} />
          <col />
          <col style={{ width: 52 }} />
          <col style={{ width: 76 }} />
          <col style={{ width: 84 }} />
          <col style={{ width: 92 }} />
          <col style={{ width: 124 }} />
          <col style={{ width: 176 }} />
        </colgroup>
        <thead>
          <tr>
            <th>
              <span className="sr">Mở chi tiết</span>
            </th>
            <th>Mã</th>
            <th>Tên NPL</th>
            <th>ĐVT</th>
            <th className="r">Cần</th>
            <th className="r">Đã lên đơn</th>
            <th className="r">Còn phải đặt</th>
            <th>Dùng ở SP</th>
            <th>Tình trạng</th>
          </tr>
        </thead>
        <tbody>
          {d.nhomCon.length === 0 ? (
            <Rong d={d} />
          ) : (
            d.nhomCon.map((g) => <Nhom key={g.lenh.id} g={g} d={d} today={today} />)
          )}
          {ksHien.length > 0 && (
            <>
              <tr className="grp ks">
                <td colSpan={SO_COT}>
                  <button
                    type="button"
                    className="tg"
                    aria-expanded={d.moKhongSo}
                    aria-label={`${d.moKhongSo ? 'Gập' : 'Mở'} danh sách lệnh chưa so được`}
                    onClick={d.latKhongSo}
                  >
                    <span aria-hidden="true">{d.moKhongSo ? '▾' : '▸'}</span>
                  </button>
                  Chưa so được · <b>{ksHien.length}</b> lệnh không có định mức ngũ kim,
                  bao bì gắn mã kho
                  {!d.moKhongSo && (
                    <span className="meta">
                      {ksHien.map((x) => x.code.replace('/26-27 - ', ' ')).join(' · ')}
                    </span>
                  )}
                </td>
              </tr>
              {d.moKhongSo &&
                ksHien.map((x) => (
                  <tr key={x.id} className="ks-l">
                    <td colSpan={SO_COT}>
                      <Link className="po" href={`/mua-hang/yeu-cau/${x.id}`}>
                        {x.code}
                      </Link>{' '}
                      <span className="mut">· {x.ly_do}</span>
                    </td>
                  </tr>
                ))}
            </>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={SO_COT}>
              {soVn(d.conXem.length)} mã · {d.nhomCon.length} lệnh
              <span className="sub">
                Không gồm: {soVn(chuaMa)} tên định mức chưa gắn mã kho (ngũ kim{' '}
                {d.can.chuaMa.NGU_KIM}, bao bì {d.can.chuaMa.PACKAGING})
                {d.can.chanQuyDoi > 0 &&
                  ` · ${d.can.chanQuyDoi} dòng chưa quy đổi được đơn vị`}{' '}
                · khung, gỗ (không đặt theo định mức)
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function Rong({ d }: { d: NplCtx }) {
  const id = d.loc.lsx
  const ks = id ? d.can.khongSo.find((x) => x.id === id) : null
  const code = id ? d.chonLoc.lenh.find((l) => l.id === id)?.code : null
  // "Đã lên đơn đủ" chỉ nói được khi bộ lọc duy nhất là lệnh — có lọc khác thì
  // rỗng có thể chỉ vì bộ lọc.
  const chiLocLenh = !d.loc.q.trim() && !d.loc.nhom && !d.ttCon
  const duHet =
    id && !ks && chiLocLenh ? d.can.con.filter((c) => c.lsx_id === id).length : 0
  return (
    <tr className="empty">
      <td colSpan={SO_COT}>
        {ks ? (
          <>
            <b>Chưa so được lệnh {ks.code}:</b> {ks.ly_do}. Tab này <b>không</b> có nghĩa
            là lệnh đã đặt đủ.{' '}
            <button type="button" className="lnk" onClick={() => d.setTab('tat_ca')}>
              Xem đơn của lệnh
            </button>
          </>
        ) : duHet > 0 ? (
          <>
            Lệnh {code} đã lên đơn đủ {duHet} mã ngũ kim, bao bì theo định mức.{' '}
            <button type="button" className="lnk" onClick={() => d.setTab('tat_ca')}>
              Xem đơn của lệnh
            </button>
          </>
        ) : (
          <>Không có mã nào còn phải đặt{d.coLoc ? ' khớp bộ lọc' : ''}.</>
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

function Nhom({ g, d, today }: { g: NhomCon; d: NplCtx; today: string }) {
  const mo = !d.gap.has(g.lenh.id)
  const ship = g.lenh.ship_date
  const con = ship ? -ngayQua(ship, today) : null
  return (
    <>
      <tr className="grp">
        <td colSpan={SO_COT}>
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
            <b>{soVn(g.rows.length)}</b> mã
          </span>
        </td>
      </tr>
      {mo && g.rows.map((c) => <Dong key={c.key} c={c} d={d} />)}
    </>
  )
}

function Dong({ c, d }: { c: NplCon; d: NplCtx }) {
  const mo = d.moChia.has(c.key)
  const sps = c.sp.map((s) => s.sp_code)
  const bam = () => {
    d.setChon(c.key)
    d.latChia(c.key)
  }
  return (
    <>
      <tr className={d.chon === c.key ? 'd sel' : 'd'} onClick={bam}>
        <td className="gut">
          <button
            type="button"
            aria-expanded={mo}
            aria-label={`${mo ? 'Gập' : 'Mở'} chi tiết ${c.ma}`}
            onClick={(e) => {
              e.stopPropagation()
              bam()
            }}
          >
            {mo ? '▾' : '▸'}
          </button>
        </td>
        <td title={c.ma}>
          <Link
            className="ma"
            href={`/mua-hang/vat-tu/${c.material_id}`}
            onClick={(e) => e.stopPropagation()}
          >
            {c.ma}
          </Link>
        </td>
        <td title={c.ten}>{c.ten}</td>
        <td className="mut">{c.dvt}</td>
        <td className="r">{soVn(c.can)}</td>
        <td className="r">{c.dat > 0 ? soVn(c.dat) : <span className="em">—</span>}</td>
        <td className="r">
          <b>{soVn(c.con)}</b>
        </td>
        <td title={sps.join(', ')}>
          <span className="mono">{sps[0]}</span>
          {sps.length > 1 && <span className="mut"> +{sps.length - 1}</span>}
        </td>
        <td>
          <TinhTrang c={c} />
        </td>
      </tr>
      {mo && (
        <tr className="det">
          <td colSpan={SO_COT}>
            <ChiTiet c={c} />
          </td>
        </tr>
      )}
    </>
  )
}

function TinhTrang({ c }: { c: NplCon }) {
  if (c.tt === 'dat_thieu') return <span className="st-w">Đặt thiếu</span>
  if (c.tt === 'gan_ten')
    return (
      <span title={`${c.gan[0].ma} ${c.gan[0].ten}`}>
        <span className="st-w">Có thể là</span>{' '}
        <span className="mono">{c.gan[0].ma}</span>
      </span>
    )
  return <span className="st-n">Chưa có đơn</span>
}

function ChiTiet({ c }: { c: NplCon }) {
  return (
    <>
      <div className="det-g">
        <div>
          <div className="det-h">Định mức cần · {c.sp.length} SP</div>
          <table className="npl-det">
            <thead>
              <tr>
                <th>SP</th>
                <th>Vị trí lắp</th>
                <th className="r">ĐM / SP</th>
                <th className="r">SL SP</th>
                <th className="r">Cần</th>
              </tr>
            </thead>
            <tbody>
              {c.sp.map((s) => (
                <tr key={s.sp_id}>
                  <td>
                    <Link className="po" href={`/thu-vien/${s.sp_id}?tab=dinh-muc`}>
                      {s.sp_code}
                    </Link>
                  </td>
                  <td className="w">{s.vi_tri.join(', ') || '—'}</td>
                  <td className="mono r">{soVn(s.per)}</td>
                  <td className="mono r">{soVn(s.sl)}</td>
                  <td className="mono r">{soVn(s.can)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          {c.tt === 'gan_ten' ? (
            <>
              <div className="det-h">Trên đơn của lệnh có dòng gần tên</div>
              <table className="npl-det">
                <thead>
                  <tr>
                    <th>Mã trên đơn</th>
                    <th>Tên trên đơn</th>
                    <th className="r">Đặt</th>
                    <th>Đơn</th>
                  </tr>
                </thead>
                <tbody>
                  {c.gan.map((g) => (
                    <tr key={`${g.po_id}|${g.ma}`}>
                      <td className="mono">{g.ma}</td>
                      <td className="w">{g.ten}</td>
                      <td className="mono r">{soVn(g.dat)}</td>
                      <td>
                        <Link className="po" href={`/mua-hang/don/${g.po_id}`}>
                          {g.po_code}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : c.don.length > 0 ? (
            <>
              <div className="det-h">Đã lên đơn</div>
              <table className="npl-det">
                <thead>
                  <tr>
                    <th>Đơn</th>
                    <th>NCC</th>
                    <th>Phụ trách</th>
                    <th>Tình trạng</th>
                    <th className="r">Đặt</th>
                    <th className="r">Đã về</th>
                  </tr>
                </thead>
                <tbody>
                  {c.don.map((x) => (
                    <tr key={x.po_id}>
                      <td>
                        <Link className="po" href={`/mua-hang/don/${x.po_id}`}>
                          {x.po_code}
                        </Link>
                      </td>
                      <td className="w">{x.supplier}</td>
                      <td>{tenGoi(x.assignee)}</td>
                      <td>{PO_STATUS_LABEL[x.status as PoStatus] ?? x.status}</td>
                      <td className="mono r">{soVn(x.dat)}</td>
                      <td className="mono r">{soVn(x.ve)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div className="det-h">Chưa có dòng đơn nào của lệnh mang mã này.</div>
          )}
        </div>
      </div>
      {c.tt === 'gan_ten' ? (
        <p className="calc">
          Định mức ghi <span className="mono">{c.ma}</span> {c.ten}, đơn của lệnh có{' '}
          <span className="mono">{c.gan[0].ma}</span> {c.gan[0].ten}. Màn <b>không</b> tự
          coi là đã đặt. Nếu là cùng một món: gắn lại mã ở định mức SP thì dòng này tự
          hết.{' '}
          <Link className="lnk" href={`/thu-vien/${c.sp[0].sp_id}?tab=dinh-muc`}>
            Mở định mức {c.sp[0].sp_code} ›
          </Link>
        </p>
      ) : (
        <p className="calc">
          Cần <b>{soVn(c.can)}</b> − đã lên đơn <b>{soVn(c.dat)}</b> ={' '}
          <span className="con">
            còn phải đặt {soVn(c.con)} {c.dvt}
          </span>
          .
        </p>
      )}
    </>
  )
}
