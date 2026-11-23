'use client'

import '../../nhap/theo-lenh/theo-lenh.css'
import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowDownToLine } from 'lucide-react'
import { ngay, TU_CHOI_NHAN } from '@/lib/kho-hang-ve'
import { ISSUE_KIND_LABEL, type IssueKind } from '@/lib/po-tracking'
import { todayVn } from '@/lib/date-vn'
import { tinhDon, type KdDong } from '@/lib/kho-don-theo-lenh'
import { ngayQua } from '@/lib/npl-theo-lenh'
import {
  ApNhom,
  ApNut,
  DauTrang,
  KhoKhung,
  Rong,
  TabNgang,
  ThanhTT,
} from '../../_erp/khung'
import { BaoSuCoSheet } from '../../nhap/bao-su-co'
import type { HangCuaDonData } from '../../nhap/tai-hang-cua-don'
import { lenhGon } from '../../ton/ton-lenh.shared'
import {
  lenhHref,
  lyDoKhoaNhan,
  TINH_NHAN,
  URL_THEO_LENH,
} from '../../nhap/theo-lenh/theo-lenh.shared'

export type DonTab = 'dong' | 'phieu' | 'dot' | 'su_co'

/** Phần của MỘT lệnh trong đơn — khi trang mở từ trang lệnh (`?lenh=`). */
export type PhanLenh = {
  lsx_id: string
  code: string
  /** Lệnh chính của đơn khi lệnh đang xem chỉ là lệnh đi kèm. */
  lenh_chinh: string | null
  gop: string[]
  /** Theo id dòng đơn — dòng không có ở đây không thuộc lệnh này. */
  dong: Record<string, { dat: number; ve: number; chia: boolean }>
}

const so = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })
const TAB_TEN: Record<DonTab, string> = {
  dong: 'Dòng hàng',
  phieu: 'Phiếu nhập',
  dot: 'Đợt giao',
  su_co: 'Sự cố',
}
const TRANG_THAI_DOT: Record<string, { label: string; cls: string }> = {
  planned: { label: 'chưa tới', cls: 'kh-tag' },
  arrived: { label: 'NCC báo đã tới', cls: 'kh-tag warn' },
  received: { label: 'đã nhận', cls: 'kh-tag done' },
}
const LOAI_PHIEU: Record<string, string> = {
  receipt: 'Phiếu nhập',
  return: 'Trả NCC',
  reversal: 'Phiếu đảo',
  adjustment: 'Điều chỉnh',
}

/**
 * KHO · TRANG MỘT ĐƠN MUA — tầng ③ (bản vẽ 2). Đầu trang + Action Pane · dải
 * thông tin đơn · tab Dòng hàng / Phiếu nhập / Đợt giao / Sự cố · một bảng mỗi
 * tab · thanh trạng thái nói ai giữ việc với NCC. Thay hộp "Hàng của đơn" hiện
 * đè lên màn (chủ dự án 23/11: đừng gộp một trang).
 */
export function DonMuaScreen({
  data,
  phan,
  lenhLink,
  tab: tabDau,
  today,
  canEdit,
}: {
  data: HangCuaDonData
  phan: PhanLenh | null
  /** Lệnh trên URL (kể cả khi đơn không thuộc lệnh đó) — cho đường dẫn quay lại. */
  lenhLink: { id: string; code: string } | null
  tab: DonTab
  today: string
  canEdit: boolean
}) {
  const { po, lines, shipments, docs, issues, free_lines } = data
  const [tab, setTab] = useState<DonTab>(tabDau)
  const [suCo, setSuCo] = useState(false)

  const doiTab = (t: DonTab) => {
    setTab(t)
    const s = new URLSearchParams(window.location.search)
    if (t === 'dong') s.delete('tab')
    else s.set('tab', t)
    const qs = s.toString()
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${qs ? `?${qs}` : ''}`,
    )
  }

  // Tình trạng cả đơn — cùng luật `tinhDon` của trang lệnh.
  const dongTinh: KdDong[] = lines.map((l) => ({
    id: l.id,
    ma: l.code ?? '',
    ten: l.name,
    dvt: l.unit,
    dat: l.ordered,
    ve: l.received,
    thieu: l.closed_short ? 0 : Math.max(l.open, 0),
    closed: l.closed_short,
    chia: false,
  }))
  const tinh = tinhDon(po.status, dongTinh)
  const tuDo = lines.length === 0
  const khoa = tuDo
    ? `${po.code} chỉ có dòng theo mã SP (gỗ…), không vào sổ kho — Cung ứng nghiệm thu ngoài sổ`
    : lyDoKhoaNhan({ po_code: po.code, status: po.status, tinh }, canEdit)

  const open = new Map(lines.map((l) => [l.id, l.open]))
  const lineById = new Map(lines.map((l) => [l.id, l]))
  const xongDot = (s: (typeof shipments)[number]) =>
    s.lines.length > 0 && s.lines.every((l) => (open.get(l.po_line_id) ?? 1) <= 0)
  const keTiep =
    shipments
      .filter((s) => s.status === 'planned' || s.status === 'arrived')
      .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.seq - b.seq))
      .find((s) => !xongDot(s)) ?? null
  const conCho = lines.filter((l) => l.open > 0 && !l.closed_short).length
  const done = lines.length - conCho
  const phieuNhap = docs.filter((d) => d.kind === 'receipt' && !d.reversed_by).length
  const suCoMo = issues.filter((i) => i.status === 'mo').length
  const tre =
    po.expected_at && (tinh === 'mot_phan' || tinh === 'chua_ve')
      ? ngayQua(po.expected_at, today)
      : 0

  const dem: Record<DonTab, number> = {
    dong: lines.length,
    phieu: docs.length,
    dot: shipments.length,
    su_co: issues.length,
  }

  return (
    <KhoKhung label={`Đơn mua ${po.code}`}>
      <DauTrang
        crumb={
          lenhLink ? (
            <>
              Kho › <Link href="/warehouse/nhap">Nhận hàng</Link> ›{' '}
              <Link href={`${URL_THEO_LENH}?chon=${lenhLink.id}`}>Theo lệnh</Link> ›{' '}
              <Link href={lenhHref(lenhLink.id)}>{lenhLink.code}</Link>
            </>
          ) : (
            <>
              Kho › <Link href="/warehouse/nhap">Nhận hàng</Link>
            </>
          )
        }
        title={<span className="kh-num">{po.code}</span>}
        ctx={
          <>
            <span className={`kd-tt ${tinh}`}>{TINH_NHAN[tinh]}</span>
            {po.status === 'cancelled' && ' · đơn đã huỷ'}
            {' · '}
            {po.supplier_name}
          </>
        }
        actions={
          <>
            <ApNhom>
              <ApNut
                primary
                icon={<ArrowDownToLine size={15} aria-hidden />}
                href={
                  khoa
                    ? undefined
                    : `/warehouse/nhap/${po.id}${keTiep ? `?dot=${keTiep.id}` : ''}`
                }
                why={khoa}
              >
                Nhận hàng
              </ApNut>
              <ApNut
                icon={<AlertTriangle size={15} aria-hidden />}
                onClick={canEdit && !tuDo ? () => setSuCo(true) : undefined}
                why={
                  !canEdit
                    ? 'Chỉ phòng Kho báo sự cố giao hàng'
                    : tuDo
                      ? 'Đơn không có dòng vào sổ kho'
                      : null
                }
              >
                Báo sự cố
              </ApNut>
            </ApNhom>
          </>
        }
      />

      <div className="kh-hc" role="group" aria-label="Thông tin đơn">
        <div>
          <span className="k">Lệnh SX</span>
          <span className="v kh-num">
            {po.lsx_code ?? '— ngoài lệnh'}
            {po.extra_lsx.length > 0 && (
              <span className="kh-mut" style={{ fontWeight: 400 }}>
                {' '}
                + {po.extra_lsx.map(lenhGon).join(', ')}
              </span>
            )}
          </span>
        </div>
        <div>
          <span className="k">Hẹn về</span>
          <span className="v kh-num">
            {po.expected_at ? ngay(po.expected_at, today) : 'chưa hẹn'}
            {tre > 0 && <span className="kh-stop"> · trễ {tre} ngày</span>}
          </span>
        </div>
        <div>
          <span className="k">Người đặt (Cung ứng)</span>
          <span className="v">{po.assignee_name ?? '—'}</span>
        </div>
        <div>
          <span className="k">Dòng đủ</span>
          <span className="v kh-num">{tuDo ? '—' : `${done}/${lines.length}`}</span>
        </div>
        <div>
          <span className="k">Phiếu nhập</span>
          <span className="v kh-num">{phieuNhap}</span>
        </div>
        <div>
          <span className="k">Đợt kế tiếp</span>
          <span className={keTiep ? 'v kh-num' : 'v mut'}>
            {keTiep
              ? `Đợt ${keTiep.seq} · ${ngay(keTiep.date, today)}`
              : conCho > 0
                ? 'chưa hẹn đợt'
                : 'không còn chờ'}
          </span>
        </div>
        {suCoMo > 0 && (
          <div>
            <span className="k">Sự cố đang mở</span>
            <span className="v kh-num kh-warn">{suCoMo}</span>
          </div>
        )}
      </div>

      <TabNgang
        label="Nội dung đơn"
        tabs={(['dong', 'phieu', 'dot', 'su_co'] as const).map((t) => ({
          key: t,
          label: TAB_TEN[t],
          on: tab === t,
          n: dem[t],
          onClick: () => doiTab(t),
          mau: 'c-nhap',
        }))}
      />

      {lenhLink && !phan && (
        <div className="kh-note mut">
          <span className="tag">Lưu ý</span>
          <span>
            Đơn này không phục vụ lệnh {lenhLink.code} — đang bày cả đơn, không có cột
            phần của lệnh.
          </span>
        </div>
      )}

      {tab === 'dong' &&
        (tuDo ? (
          <Rong
            tieuDe={`${po.code} không có dòng vào sổ kho`}
            lyDo={`Đơn chỉ có ${free_lines} dòng theo mã SP (gỗ…): không vào tồn kho, Cung ứng nghiệm thu ngoài sổ. Thủ kho chỉ cần biết có xe tới.`}
            tiep={
              <Link href="/warehouse/nhap" className="kh-btn">
                Về Nhận hàng
              </Link>
            }
          />
        ) : (
          <div className="kh-grid">
            <table className="kh-tb" aria-label={`Dòng hàng của ${po.code}`}>
              <colgroup>
                <col style={{ width: 104 }} />
                <col />
                <col style={{ width: 64 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 104 }} />
                <col style={{ width: 96 }} />
                {phan && <col style={{ width: 210 }} />}
              </colgroup>
              <thead>
                <tr>
                  <th>Mã VT</th>
                  <th>Tên vật tư</th>
                  <th>ĐVT</th>
                  <th className="r">Đặt</th>
                  <th className="r">Đã nhận</th>
                  <th className="r">Còn chờ</th>
                  <th>Đợt</th>
                  {phan && <th>Phần của {lenhGon(phan.code)}</th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const p = phan?.dong[l.id]
                  return (
                    <tr key={l.id}>
                      <td className="kh-ma">{l.code ?? '—'}</td>
                      <td title={l.name}>{l.name}</td>
                      <td className="kh-mut">{l.unit}</td>
                      <td className="r kh-num">{so(l.ordered)}</td>
                      <td className="r kh-num">
                        {l.received > 0 ? (
                          so(l.received)
                        ) : (
                          <span className="kh-empty">·</span>
                        )}
                      </td>
                      <td className="r kh-num">
                        {l.closed_short ? (
                          <span className="kh-tag">chốt thiếu</span>
                        ) : l.open > 0 ? (
                          <span className="kh-warn">{so(l.open)}</span>
                        ) : (
                          <span className="kh-empty">·</span>
                        )}
                      </td>
                      <td className="kh-mut kh-num">
                        {l.dots.length ? l.dots.map((d) => `Đợt ${d}`).join(', ') : '—'}
                      </td>
                      {phan && (
                        <td className="kh-num">
                          {!p ? (
                            <span className="kh-empty">dòng của lệnh khác</span>
                          ) : p.chia ? (
                            <>
                              {so(p.dat)} đặt · {so(p.ve)} đã nhận
                            </>
                          ) : (
                            <span className="kh-mut">cả dòng</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={phan ? 8 : 7}>
                    {lines.length} dòng · còn chờ {conCho}
                    {free_lines > 0 && ` · ${free_lines} dòng tự do ngoài sổ kho`} · “Đã
                    nhận” lấy từ phiếu nhập đã ghi, không từ lời báo của NCC
                    {phan && ' · dòng chia nhiều lệnh: hàng về giao lệnh xuất trước'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}

      {tab === 'phieu' &&
        (docs.length === 0 ? (
          <Rong
            tieuDe={`${po.code} chưa có phiếu nhập nào`}
            lyDo="Chưa có hàng của đơn này về kho."
            tiep={
              <button type="button" className="kh-btn" onClick={() => doiTab('dong')}>
                Xem dòng hàng
              </button>
            }
          />
        ) : (
          <div className="kh-grid">
            <table className="kh-tb" aria-label={`Phiếu của ${po.code}`}>
              <colgroup>
                <col style={{ width: 170 }} />
                <col />
                <col style={{ width: 100 }} />
                <col style={{ width: 120 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Phiếu</th>
                  <th>Loại</th>
                  <th className="r">Ngày</th>
                  <th className="r">Số lượng</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.doc_id}>
                    <td>
                      <Link
                        href={`/warehouse/phieu/${d.doc_id}`}
                        className="kh-ma kd-pnk-lnk"
                      >
                        {d.code}
                      </Link>
                    </td>
                    <td className="kh-mut">
                      {LOAI_PHIEU[d.kind] ?? d.kind}
                      {d.reversed_by && ` · đã đảo (${d.reversed_by})`}
                    </td>
                    <td className="r kh-num">{ngay(d.at, today)}</td>
                    <td className="r kh-num">{so(d.qty_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>
                    {docs.length} phiếu · {phieuNhap} phiếu nhập còn hiệu lực · số lượng
                    là tổng các dòng của phiếu (có thể khác đơn vị)
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}

      {tab === 'dot' &&
        (shipments.length === 0 ? (
          <Rong
            tieuDe="Đơn chưa chia đợt giao"
            lyDo="NCC giao theo hẹn về của đơn. Chia đợt là việc của Cung ứng."
          />
        ) : (
          <div className="kh-grid">
            <table className="kh-tb" aria-label={`Đợt giao của ${po.code}`}>
              <colgroup>
                <col style={{ width: 80 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 190 }} />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th>Đợt</th>
                  <th className="r">Hẹn</th>
                  <th>Tình trạng</th>
                  <th>Chở</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => {
                  const xong =
                    (s.status === 'planned' || s.status === 'arrived') && xongDot(s)
                  const tt = TRANG_THAI_DOT[s.status] ?? {
                    label: s.status,
                    cls: 'kh-tag',
                  }
                  const ma = s.lines
                    .map((l) => lineById.get(l.po_line_id))
                    .filter((l): l is NonNullable<typeof l> => !!l)
                  return (
                    <tr key={s.id}>
                      <td className="kh-num">Đợt {s.seq}</td>
                      <td className="r kh-num">{ngay(s.date, today)}</td>
                      <td>
                        {xong ? (
                          <span className="kh-tag done">đã nhập đủ trước hạn</span>
                        ) : (
                          <span className={tt.cls}>{tt.label}</span>
                        )}
                      </td>
                      <td title={ma.map((l) => l.code ?? l.name).join(', ')}>
                        {ma.length === 1
                          ? `${ma[0].code ?? ma[0].name} · ${so(s.lines[0].qty)} ${ma[0].unit}`
                          : `${s.lines.length} dòng`}
                        {s.note && <span className="kh-mut"> · {s.note}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>
                    {shipments.length} đợt · Cung ứng hẹn với NCC
                    {po.assignee_name ? ` (${po.assignee_name})` : ''}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}

      {tab === 'su_co' &&
        (issues.length === 0 ? (
          <Rong
            tieuDe="Chưa có sự cố giao hàng nào"
            lyDo="Hàng tới sai, hỏng, thiếu — hoặc không nhận lô — thì bấm Báo sự cố: người đặt bên Cung ứng nhận thông báo."
          />
        ) : (
          <div className="kh-grid">
            <table className="kh-tb" aria-label={`Sự cố của ${po.code}`}>
              <colgroup>
                <col style={{ width: 80 }} />
                <col style={{ width: 130 }} />
                <col />
                <col style={{ width: 150 }} />
                <col style={{ width: 100 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="r">Ngày</th>
                  <th>Loại</th>
                  <th>Mô tả</th>
                  <th>Người báo</th>
                  <th>Tình trạng</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((i) => {
                  const tuChoi = i.description.startsWith(TU_CHOI_NHAN)
                  const moTa = tuChoi
                    ? i.description.slice(TU_CHOI_NHAN.length).trim()
                    : i.description
                  return (
                    <tr key={i.id}>
                      <td className="r kh-num">
                        {ngay(todayVn(new Date(i.created_at)), today)}
                      </td>
                      <td>{ISSUE_KIND_LABEL[i.kind as IssueKind] ?? i.kind}</td>
                      <td
                        title={[
                          i.description,
                          i.resolution && `Cách xử lý: ${i.resolution}`,
                        ]
                          .filter(Boolean)
                          .join(' — ')}
                      >
                        {tuChoi && <span className="kh-tag warn">từ chối nhận</span>}
                        {i.qty != null ? `${so(i.qty)} · ` : ''}
                        {moTa}
                      </td>
                      <td className="kh-mut">{i.created_by_name ?? '—'}</td>
                      <td>
                        {i.status === 'mo' ? (
                          <span className="kh-tag warn">đang mở</span>
                        ) : (
                          <span className="kh-tag done">đã xử lý</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>
                    {issues.length} sự cố · {suCoMo} đang mở · Kho báo, Cung ứng đóng
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}

      <ThanhTT
        left={
          <>
            Chỉ xem. Hẹn lại, chốt thiếu, đòi giao bù là việc của Cung ứng
            {po.assignee_name ? ` (người đặt: ${po.assignee_name})` : ''}
          </>
        }
        right={
          phan?.lenh_chinh ? (
            <span>đơn gộp · lệnh chính {lenhGon(phan.lenh_chinh)}</span>
          ) : phan && phan.gop.length > 0 ? (
            <span>dùng chung {phan.gop.length + 1} lệnh</span>
          ) : undefined
        }
      />

      {suCo && <BaoSuCoSheet data={data} onClose={() => setSuCo(false)} />}
    </KhoKhung>
  )
}
