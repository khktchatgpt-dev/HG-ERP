'use client'

import '../theo-lenh.css'
import { useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowDownToLine, FileText, Package } from 'lucide-react'
import { isoToVn } from '@/lib/date-vn'
import { ngay } from '@/lib/kho-hang-ve'
import {
  nganCua,
  phieuCuaLenh,
  xepDon,
  type KdDonLenh,
  type KdLenhTong,
  type KdNgan,
} from '@/lib/kho-don-theo-lenh'
import { ngayQua } from '@/lib/npl-theo-lenh'
import {
  ApNhom,
  ApNut,
  DauTrang,
  KhoKhung,
  Rong,
  TabNgang,
  ThanhTT,
} from '../../../_erp/khung'
import { lenhGon } from '../../../ton/ton-lenh.shared'
import { donHref, lyDoKhoaNhan, TINH_NHAN, URL_THEO_LENH } from '../theo-lenh.shared'

export type LenhTab = KdNgan | 'phieu'

const TAB_TEN: Record<LenhTab, string> = {
  cho: 'Chờ hàng',
  chua_dat: 'Chưa đặt',
  du: 'Về đủ',
  phieu: 'Phiếu nhập',
}
const RONG: Record<KdNgan, string> = {
  cho: 'Không còn đơn nào đang chờ hàng cho lệnh này.',
  chua_dat: 'Không có đơn nháp hay chờ duyệt nào của lệnh này.',
  du: 'Chưa đơn nào của lệnh này nhận đủ.',
}

/**
 * KHO · TRANG MỘT LỆNH — tầng ② của "Nhận hàng › Theo lệnh" (bản vẽ 2).
 * Đầu trang + Action Pane · dải số của lệnh · tab Chờ hàng / Chưa đặt / Về đủ /
 * Phiếu nhập · MỘT bảng phẳng (không mở gì dưới dòng) · thanh trạng thái.
 * Bấm dòng = chọn đơn → "Nhận hàng <đơn>"; bấm mã đơn / Enter → trang đơn.
 */
export function LenhScreen({
  lenh,
  rows,
  tab: tabDau,
  today,
  canEdit,
  giu,
}: {
  /**
   * Kho giữ từng đơn (po_id → tên; `khac` = đơn của người khác khi người xem là nhân
   * viên Kho đang "của tôi" — chữ nhạt). Không có = chưa có người Kho, bỏ cột.
   */
  giu?: Record<string, { ten: string; khac: boolean }>
  lenh: KdLenhTong
  rows: KdDonLenh[]
  tab: LenhTab | null
  today: string
  canEdit: boolean
}) {
  const router = useRouter()
  const theoNgan = (n: KdNgan) => rows.filter((r) => nganCua(r.tinh) === n).sort(xepDon)
  const phieu = phieuCuaLenh(rows)
  const dem: Record<LenhTab, number> = {
    cho: theoNgan('cho').length,
    chua_dat: theoNgan('chua_dat').length,
    du: theoNgan('du').length,
    phieu: phieu.length,
  }
  const [tab, setTab] = useState<LenhTab>(
    tabDau ?? (dem.cho > 0 ? 'cho' : dem.chua_dat > 0 ? 'chua_dat' : 'du'),
  )
  const [chon, setChon] = useState<string | null>(null)

  const doiTab = (t: LenhTab) => {
    setTab(t)
    // Action Pane chỉ nói về đơn đang THẤY trên màn.
    setChon(null)
    const url = `${window.location.pathname}${t === 'cho' ? '' : `?tab=${t}`}`
    window.history.replaceState(null, '', url)
  }
  const ds = tab === 'phieu' ? [] : theoNgan(tab)
  const chonDon = rows.find((r) => r.key === chon) ?? null
  const khoa = lyDoKhoaNhan(chonDon, canEdit)
  const daDat = lenh.don - lenh.chua_dat
  const conNgay = lenh.ship_date ? ngayQua(lenh.ship_date, today) : null
  const sai = ds.filter((r) => r.tinh === 'huy').length
  const moDon = (r: KdDonLenh) => router.push(donHref(r.po_id, lenh.id))
  const phim = (e: KeyboardEvent<HTMLTableRowElement>, r: KdDonLenh) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      moDon(r)
    } else if (e.key === ' ') {
      e.preventDefault()
      setChon(r.key)
    }
  }

  return (
    <KhoKhung label={`Đơn mua của lệnh ${lenh.code}`}>
      <DauTrang
        crumb={
          <>
            Kho › <Link href="/warehouse/nhap">Nhận hàng</Link> ›{' '}
            <Link href={`${URL_THEO_LENH}?chon=${lenh.id}`}>Theo lệnh</Link>
          </>
        }
        title={<span className="kh-num">{lenh.code}</span>}
        ctx={
          <>
            {lenh.khach ?? 'chưa ghi khách'}
            {lenh.ship_date && (
              <>
                {' '}
                · xuất hàng <b>{isoToVn(lenh.ship_date)}</b>
                {conNgay != null && conNgay < 0 && ` (còn ${-conNgay} ngày)`}
                {conNgay != null && conNgay > 0 && (
                  <span className="kh-stop"> (đã qua {conNgay} ngày)</span>
                )}
              </>
            )}
          </>
        }
        actions={
          <>
            <ApNhom>
              <ApNut
                primary
                icon={<ArrowDownToLine size={15} aria-hidden />}
                href={chonDon && !khoa ? `/warehouse/nhap/${chonDon.po_id}` : undefined}
                why={khoa}
              >
                {chonDon ? `Nhận hàng ${chonDon.po_code}` : 'Nhận hàng'}
              </ApNut>
              <ApNut
                icon={<FileText size={15} aria-hidden />}
                href={chonDon ? donHref(chonDon.po_id, lenh.id) : undefined}
                why={chonDon ? null : 'Chọn một đơn trong bảng trước'}
              >
                Xem đơn
              </ApNut>
            </ApNhom>
            <ApNhom>
              <ApNut
                icon={<Package size={15} aria-hidden />}
                href={`/warehouse/ton?xem=lenh&lenh=${lenh.id}`}
              >
                Tồn của lệnh
              </ApNut>
            </ApNhom>
          </>
        }
      />

      <div className="kh-hc" role="group" aria-label="Số của lệnh">
        <div>
          <span className="k">Đơn đã đặt</span>
          <span className="v kh-num">{daDat}</span>
        </div>
        <div>
          <span className="k">Về đủ</span>
          <span className="v kh-num kh-ok">{lenh.du}</span>
        </div>
        <div>
          <span className="k">Về một phần</span>
          <span className={`v kh-num${lenh.mot_phan ? 'kh-warn' : 'mut'}`}>
            {lenh.mot_phan}
          </span>
        </div>
        <div>
          <span className="k">Chưa về</span>
          <span className={`v kh-num${lenh.chua_ve ? '' : 'mut'}`}>{lenh.chua_ve}</span>
        </div>
        <div>
          <span className="k">Trễ hẹn</span>
          <span className={`v kh-num${lenh.tre ? 'kh-stop' : 'mut'}`}>{lenh.tre}</span>
        </div>
        <div>
          <span className="k">Chưa đặt (nháp, chờ duyệt)</span>
          <span className="v kh-num mut">{lenh.chua_dat}</span>
        </div>
        <div>
          <span className="k">Phiếu nhập gần nhất</span>
          <span className="v">
            {lenh.phieu_cuoi ? (
              <>
                <Link
                  href={`/warehouse/phieu/${lenh.phieu_cuoi.doc_id}`}
                  className="kh-lnk kh-num"
                >
                  {lenh.phieu_cuoi.code}
                </Link>{' '}
                <span className="kh-mut kh-num">{isoToVn(lenh.phieu_cuoi.date)}</span>
              </>
            ) : (
              <span className="kh-mut">chưa có</span>
            )}
          </span>
        </div>
      </div>

      <TabNgang
        label="Đơn của lệnh"
        tabs={(['cho', 'chua_dat', 'du', 'phieu'] as const).map((t) => ({
          key: t,
          label: TAB_TEN[t],
          on: tab === t,
          n: dem[t],
          onClick: () => doiTab(t),
          mau: 'c-nhap',
        }))}
      />

      {chonDon && khoa && tab !== 'phieu' && ds.some((r) => r.key === chon) && (
        <div className="kh-note mut">
          <span className="tag">Chưa nhận được</span>
          <span>{khoa}.</span>
        </div>
      )}

      {rows.length === 0 ? (
        <Rong
          tieuDe={`${lenh.code} chưa có đơn mua nào`}
          lyDo="Cung ứng chưa lập đơn cho lệnh này nên chưa có gì để nhận. Khi có đơn, nó hiện ở tab Chưa đặt rồi sang Chờ hàng khi NCC xác nhận."
          tiep={
            <Link href={`${URL_THEO_LENH}?chon=${lenh.id}`} className="kh-btn">
              Về danh sách lệnh
            </Link>
          }
        />
      ) : tab === 'phieu' ? (
        phieu.length === 0 ? (
          <Rong
            tieuDe="Chưa ghi phiếu nhập nào cho lệnh này"
            lyDo="Chưa đơn nào của lệnh có hàng về kho."
            tiep={
              <button type="button" className="kh-btn" onClick={() => doiTab('cho')}>
                Xem đơn chờ hàng
              </button>
            }
          />
        ) : (
          <div className="kh-grid">
            <table className="kh-tb" aria-label={`Phiếu nhập của lệnh ${lenh.code}`}>
              <colgroup>
                <col style={{ width: 170 }} />
                <col style={{ width: 110 }} />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th>Phiếu</th>
                  <th className="r">Ngày</th>
                  <th>Đơn mua</th>
                </tr>
              </thead>
              <tbody>
                {phieu.map((p) => (
                  <tr key={p.doc_id}>
                    <td>
                      <Link
                        href={`/warehouse/phieu/${p.doc_id}`}
                        className="kh-ma kd-pnk-lnk"
                      >
                        {p.code}
                      </Link>
                    </td>
                    <td className="r kh-num">{isoToVn(p.date)}</td>
                    <td className="kd-dons">
                      {p.dons.map((code) => {
                        const r = rows.find((x) => x.po_code === code)
                        return r ? (
                          <Link
                            key={code}
                            href={donHref(r.po_id, lenh.id)}
                            className="kh-ma kd-lnk"
                          >
                            {code}
                          </Link>
                        ) : (
                          <span key={code} className="kh-ma">
                            {code}
                          </span>
                        )
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    {phieu.length} phiếu nhập · mới nhất trước · không gồm phiếu đã đảo
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      ) : ds.length === 0 ? (
        <Rong
          tieuDe={RONG[tab]}
          lyDo={`Lệnh có ${rows.length} đơn ở các tab khác.`}
          tiep={
            <button
              type="button"
              className="kh-btn"
              onClick={() => doiTab(dem.cho > 0 ? 'cho' : dem.du > 0 ? 'du' : 'chua_dat')}
            >
              Xem tab khác
            </button>
          }
        />
      ) : (
        <div className="kh-grid">
          <table
            className="kh-tb"
            aria-label={`Đơn ${TAB_TEN[tab]} của lệnh ${lenh.code}`}
          >
            <colgroup>
              {/* Có cột Kho giữ thì thu Đơn / NCC / Tình trạng — đo 24/11: không thu thì Phiếu nhập còn 88px. */}
              <col style={{ width: giu ? 200 : 230 }} />
              <col style={{ width: giu ? 170 : 200 }} />
              <col style={{ width: giu ? 140 : 170 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 86 }} />
              <col style={{ width: 80 }} />
              {giu && <col style={{ width: 120 }} />}
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>Đơn</th>
                <th>Nhà cung cấp</th>
                <th>Tình trạng</th>
                <th className="r" title="Dòng đã nhận đủ / tổng dòng của lệnh này">
                  Dòng đủ
                </th>
                <th className="r">Hẹn về</th>
                <th>Trễ</th>
                {giu && <th title="Nhân viên Kho giữ nhóm vật tư của đơn">Kho giữ</th>}
                <th>Phiếu nhập đã ghi</th>
              </tr>
            </thead>
            <tbody>
              {ds.map((r) => {
                const on = r.key === chon
                return (
                  <tr
                    key={r.key}
                    className={['d', on && 'on', r.tinh === 'huy' && 'kd-huy', giu?.[r.po_id]?.khac && 'kd-khac']
                      .filter(Boolean)
                      .join(' ')}
                    tabIndex={0}
                    aria-selected={on}
                    onClick={() => setChon(r.key)}
                    onDoubleClick={() => moDon(r)}
                    onKeyDown={(e) => phim(e, r)}
                  >
                    <td
                      title={
                        r.gop.length ? `Dùng chung với ${r.gop.join(', ')}` : r.po_code
                      }
                    >
                      <Link
                        href={donHref(r.po_id, lenh.id)}
                        className="kh-ma kd-lnk"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.po_code}
                      </Link>
                      {r.lenh_chinh ? (
                        <span className="kh-tag" style={{ marginLeft: 6 }}>
                          gộp · {lenhGon(r.lenh_chinh)}
                        </span>
                      ) : r.gop.length > 0 ? (
                        <span className="kh-tag" style={{ marginLeft: 6 }}>
                          chung {r.gop.length + 1} lệnh
                        </span>
                      ) : null}
                    </td>
                    <td title={r.supplier}>{r.supplier || '—'}</td>
                    <td>
                      <span className={`kd-tt ${r.tinh}`}>{TINH_NHAN[r.tinh]}</span>
                      {r.chot_thieu && <span className="kh-tag">chốt thiếu</span>}
                    </td>
                    <td className="r kh-num">
                      {r.dong_du}/{r.dong_tong}
                    </td>
                    <td className="r kh-num">
                      {r.hen ? ngay(r.hen, today) : <span className="kh-empty">—</span>}
                    </td>
                    <td>
                      {r.tre ? <span className="kh-stop">{r.tre} ngày</span> : null}
                    </td>
                    {giu && (
                      <td className="kh-mut" title={giu[r.po_id]?.ten || undefined}>
                        {giu[r.po_id]?.ten || '—'}
                      </td>
                    )}
                    <td className="kd-pnk">
                      {r.phieu.length === 0 ? (
                        <span className="kh-empty">chưa có phiếu</span>
                      ) : (
                        r.phieu.map((p) => (
                          <span key={p.doc_id} className="kd-p">
                            <Link
                              href={`/warehouse/phieu/${p.doc_id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {p.code}
                            </Link>
                            <span className="ng">{isoToVn(p.date).slice(0, 5)}</span>
                          </span>
                        ))
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>
                  {ds.length} đơn {TAB_TEN[tab].toLowerCase()}
                  {sai > 0 && ` · ${sai} đơn huỷ có phiếu (dòng đỏ, không đếm vào số)`}
                </td>
                <td className="r">
                  {ds.reduce((s, r) => s + r.dong_du, 0)}/
                  {ds.reduce((s, r) => s + r.dong_tong, 0)}
                </td>
                <td colSpan={giu ? 4 : 3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {tab === 'du' && sai > 0 && (
        <div className="kh-note mut">
          <span className="tag">Sai lệch</span>
          <span>
            {sai} đơn đã huỷ mà vẫn có phiếu nhập. Kho không sửa được đơn: báo người cầm
            đơn bên Cung ứng để đảo phiếu hoặc mở lại đơn.
          </span>
        </div>
      )}

      <ThanhTT
        left={
          chonDon ? (
            <>
              Đang chọn <b className="kh-num">{chonDon.po_code}</b> · Enter hoặc bấm mã
              đơn để mở trang đơn
            </>
          ) : (
            <>Bấm dòng để chọn đơn · bấm mã đơn để mở trang đơn</>
          )
        }
        right={<span>đơn gộp hiện ở mọi lệnh nó phục vụ</span>}
      />
    </KhoKhung>
  )
}
