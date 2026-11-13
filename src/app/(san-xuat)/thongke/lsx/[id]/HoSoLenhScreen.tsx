'use client'

import Link from 'next/link'
import {
  ApNhom,
  ApNut,
  DauTrang,
  SxKhung,
  TabNgang,
} from '@/app/(workspace)/production/_erp/khung'
import { DocNotesPanel } from '@/components/doc/DocNotesPanel'
import { isStale } from '@/lib/lsx-holder'
import { cx, dmy, fmt, STATUS_LABEL, TAB_LABEL, TABS } from './ho-so-lenh.shared'
import { BangDongBo, DaiNamSo } from './bang-dong-bo'
import { DaiCongDoan } from './khoi-luong'
import { TabKeHoach } from './tab-ke-hoach'
import { TabPhieu } from './tab-phieu'
import { useHoSoLenh, type HoSoLenhProps } from './useHoSoLenh'

/**
 * HỒ SƠ LỆNH — màn S3 của bản vẽ 03/11/2026; tab Tiến độ dựng lại GỌN 12/11/2026
 * theo bản vẽ https://claude.ai/artifact/T2otDmrhZce8LZSmow3itu (chủ dự án: "rối
 * và nhiều nội dung thừa"; duyệt Q1–Q7). Phần trên bảng 437px → ~200px, bảng
 * 537 dòng → 41 dòng mặc định.
 *
 * Gốc:
 * (https://claude.ai/artifact/4VNmsX9hoLFmgic9AGrCci), B5 của
 * docs/san-xuat-cau-hinh-thiet-ke.md. KHÔNG kit — khung `_erp` của Sản xuất.
 *
 * Quản đốc — "lệnh này mỗi cụm xong bao nhiêu, đã giao / nhận / tồn ở đâu, ai
 * giữ?". Bảng đồng bộ ba tầng × công đoạn; bấm ô ra năm con số (cùng hàm với
 * Ghi sản lượng và Giao nhận). Kế hoạch tổ & hạn là TAB, không phải màn riêng.
 * Trao đổi dùng lại DocNotesPanel (file riêng, hệ kit — không trộn trong file này).
 */
export function HoSoLenhScreen(props: HoSoLenhProps) {
  const d = useHoSoLenh(props)
  const { data, p } = d
  const { lsx, holder } = data
  const nhanTab = {
    dong_bo: data.lines.length,
    ke_hoach: data.jobs.length,
    phieu: data.pbs.length + data.pgt.length,
    trao_doi: undefined,
  } as const

  return (
    <SxKhung bare label={`Lệnh ${lsx.code}`}>
      <div className="sx-body">
        <DauTrang
          crumb="Lệnh sản xuất"
          title={lsx.code}
          ctx={
            <>
              {/* Một dòng (Q bản vẽ gọn): khách · số đợt · SL · khoảng ngày xuất.
                  Mã đơn + ngày duyệt sang tooltip / tab Trao đổi. */}
              <span
                title={[
                  lsx.order_codes.length ? `Đơn ${lsx.order_codes.join(' · ')}` : null,
                  lsx.approved_at ? `duyệt ${dmy(lsx.approved_at)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              >
                {lsx.customer_name}
                {data.groups.length > 1 && (
                  <>
                    {' '}
                    · <b>{data.groups.length}</b> đợt
                  </>
                )}{' '}
                · <b>{fmt(d.tongDat)}</b> {data.lines[0]?.unit ?? 'cái'}
                {d.shipDates.length > 0 && (
                  <>
                    {' '}
                    · xuất <b>{dmy(d.shipDates[0])}</b>
                    {d.shipDates.at(-1) !== d.shipDates[0] && (
                      <>
                        {' '}
                        → <b>{dmy(d.shipDates.at(-1)!)}</b>
                      </>
                    )}
                  </>
                )}
              </span>{' '}
              <span
                className={cx('pill', holder.closed ? 'd' : isStale(holder) ? 'w' : 'm')}
                title={`${STATUS_LABEL[lsx.status] ?? lsx.status} — ${holder.what}`}
              >
                {holder.closed
                  ? (STATUS_LABEL[lsx.status] ?? lsx.status)
                  : holder.days != null
                    ? `${holder.who} giữ ${holder.days} ngày${isStale(holder) ? ' · nằm im' : ''}`
                    : (STATUS_LABEL[lsx.status] ?? lsx.status)}
              </span>
            </>
          }
          actions={
            <>
              <ApNhom>
                {p.canRecord && (
                  <ApNut href={`/thongke/ghi?lsx=${lsx.id}`}>Ghi sản lượng</ApNut>
                )}
                {p.canRecord && (
                  <ApNut href={`/thongke/giao-nhan?lsx=${lsx.id}`}>Lập phiếu giao</ApNut>
                )}
              </ApNhom>
              <ApNhom>
                <details className="sx-more">
                  <summary className="sx-btn" aria-label="Thêm thao tác">
                    ⋯
                  </summary>
                  <div className="sx-menu" role="menu">
                    <Link role="menuitem" href={`/thongke/lo-trinh?lsx=${lsx.id}`}>
                      Lộ trình công đoạn
                    </Link>
                    {p.canRecord && (
                      <Link role="menuitem" href={`/thongke/lsx/${lsx.id}/dinh-hinh`}>
                        Bảng chi tiết
                      </Link>
                    )}
                    <a role="menuitem" href={`/api/dept/production/lsx/${lsx.id}/export`}>
                      Tải Excel
                    </a>
                  </div>
                </details>
              </ApNhom>
              {/* Q6: Đóng lệnh chỉ hiện khi lệnh đã có số hoàn thiện — lệnh chưa
                  làm gì thì nút + câu chặn dài nhất đầu trang là thừa. */}
              {d.closable && d.hoanThien > 0 && (
                <ApNhom>
                  {d.dongWhy && p.canForceComplete && d.viecDo > 0 && !d.epMo ? (
                    <ApNut onClick={() => d.setEpMo(true)}>Ép đóng lệnh…</ApNut>
                  ) : null}
                  <ApNut primary onClick={d.hoiDong} why={d.dongWhy} busy={d.busy}>
                    Đóng lệnh…
                  </ApNut>
                </ApNhom>
              )}
            </>
          }
        />

        {d.xacNhanMo && (
          <div className={cx('sx-note', d.hoanThien < d.tongDat && 'stop')}>
            <b>Đóng lệnh {lsx.code}?</b>
            <span>
              Hoàn thiện {fmt(d.hoanThien)} / {fmt(d.tongDat)} bộ
              {d.hoanThien < d.tongDat
                ? ' — CHƯA ĐỦ, đóng là chốt số này, sổ không ghi thêm được'
                : ' — đủ'}
              . Sau khi đóng: kế hoạch tổ & hạn khoá, đơn hàng chuyển sang “Sẵn sàng
              xuất”, không mở lại được.
            </span>
            <button
              type="button"
              className="lnk"
              onClick={() => d.dongLenh(false)}
              disabled={d.busy}
            >
              {d.busy ? 'Đang đóng…' : 'Đóng lệnh'}
            </button>
            <button
              type="button"
              className="lnk mut"
              onClick={() => d.setXacNhanMo(false)}
              disabled={d.busy}
            >
              Thôi
            </button>
          </div>
        )}

        {d.epMo && (
          <div className="sx-note stop">
            <b>Ép đóng lệnh</b> khi còn {d.viecDo} việc dở — ghi vì sao, nhật ký giữ lại
            lý do.
            <input
              className="sx-in"
              value={d.epLyDo}
              onChange={(e) => d.setEpLyDo(e.target.value)}
              placeholder="lý do (bắt buộc)"
              aria-label="Lý do ép đóng"
              style={{ width: 300, marginLeft: 8 }}
            />
            <button
              type="button"
              className="lnk"
              onClick={() => d.dongLenh(true)}
              disabled={!d.epLyDo.trim() || d.busy}
            >
              Ép đóng
            </button>
            <button type="button" className="lnk mut" onClick={() => d.setEpMo(false)}>
              Thôi
            </button>
          </div>
        )}

        <TabNgang
          label="Hồ sơ lệnh"
          tabs={TABS.map((t) => ({
            key: t,
            label: TAB_LABEL[t],
            n: nhanTab[t],
            on: d.tab === t,
            onClick: () => d.setTab(t),
          }))}
        />

        {d.loi && <div className="sx-err">{d.loi}</div>}
        {d.thongBao && !d.loi && (
          <div className="sx-note ok">
            {d.thongBao}
            <button type="button" className="lnk mut" onClick={() => d.setThongBao(null)}>
              Đóng
            </button>
          </div>
        )}

        {d.tab === 'dong_bo' && (
          <>
            <ViecPhaiLam d={d} />
            <DaiCongDoan d={d} />
            <div className="sx-hc">
              <input
                className="sx-in"
                value={d.tim}
                onChange={(e) => d.setTim(e.target.value)}
                placeholder="Tìm mã hàng, cụm, chi tiết"
                aria-label="Tìm mã hàng, cụm, chi tiết"
                style={{ width: 260 }}
              />
              {data.groups.length > 1 && (
                <label className="c">
                  Đợt
                  <select
                    value={d.dotLoc}
                    onChange={(e) => d.setDotLoc(e.target.value)}
                    aria-label="Lọc đợt"
                  >
                    <option value="">tất cả</option>
                    {data.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                        {g.ship_date ? ` · xuất ${dmy(g.ship_date)}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(d.tim || d.dotLoc) && (
                <button
                  type="button"
                  className="lnk"
                  onClick={() => {
                    d.setTim('')
                    d.setDotLoc('')
                  }}
                >
                  Bỏ lọc
                </button>
              )}
              <span className="sp">
                <button type="button" className="lnk" onClick={d.moHet}>
                  Mở hết
                </button>
                {' · '}
                <button type="button" className="lnk" onClick={d.gapHet}>
                  Gập hết
                </button>
              </span>
            </div>
            <BangDongBo d={d} />
            <DaiNamSo d={d} />
          </>
        )}
        {d.tab === 'ke_hoach' && <TabKeHoach d={d} />}
        {d.tab === 'phieu' && <TabPhieu d={d} />}
        {d.tab === 'trao_doi' && (
          <div className="sx-grid" style={{ padding: 12 }}>
            <DocNotesPanel
              docType="lsx"
              docId={lsx.id}
              meId={p.meId}
              meName={p.meName}
              followerNames={[]}
              marks={[
                { key: 'created', at: lsx.created_at, label: 'Phát hành lệnh' },
                { key: 'approved', at: lsx.approved_at, label: 'Giám đốc duyệt' },
                { key: 'completed', at: lsx.completed_at, label: 'Đóng lệnh' },
              ]}
              emptyHint={
                <>
                  Chưa ai ghi gì về lệnh này. Ghi lại những gì đang xảy ra ngoài hệ thống
                  — tổ nào báo thiếu vật tư, vì sao công đoạn đứng — để tháng sau còn tra
                  được vì sao lệnh trễ.
                </>
              }
            />
          </div>
        )}

      </div>
    </SxKhung>
  )
}

/**
 * DÒNG VIỆC PHẢI LÀM — một dòng vàng, chỉ hiện khi có việc (Q3 bản vẽ gọn):
 * thay 5 ô số + "chưa giao tổ & hạn" lặp ở từng ô công đoạn. Mỗi mục kèm chỗ gỡ.
 */
function ViecPhaiLam({ d }: { d: ReturnType<typeof useHoSoLenh> }) {
  const { data, p } = d
  const k = data.khoi_luong
  const chuaGiao = k.stages.filter((s) => s.jobs === 0).length
  const items: React.ReactNode[] = []
  if (k.stages.length > 0 && chuaGiao > 0)
    items.push(
      <span key="giao">
        <b className="num">
          {chuaGiao} / {k.stages.length}
        </b>{' '}
        công đoạn chưa giao tổ &amp; hạn
        {p.canPlan && (
          <Link className="lnk" href={`/kehoach-sx/${data.lsx.id}`} style={{ marginLeft: 6 }}>
            Giao tổ &amp; hạn
          </Link>
        )}
      </span>,
    )
  if (d.unshapedLines.length > 0)
    items.push(
      <span key="dinh-hinh">
        {d.unshapedLines.slice(0, 2).map((l, i) => (
          <span key={l.order_line_id}>
            {i > 0 && ', '}
            <span className="ma">{l.product_code}</span>
            {l.dot && <> {l.dot.toLowerCase()}</>}
          </span>
        ))}
        {d.unshapedLines.length > 2 && ` và ${d.unshapedLines.length - 2} dòng`} chưa định
        hình
        {p.canRecord && (
          <Link
            className="lnk"
            href={`/thongke/lsx/${data.lsx.id}/dinh-hinh`}
            style={{ marginLeft: 6 }}
          >
            Bảng chi tiết
          </Link>
        )}
      </span>,
    )
  if (k.unassigned.parts > 0)
    items.push(
      <span key="cum">
        <b className="num">{fmt(k.unassigned.qty)}</b> chi tiết đi qua công đoạn ghép mà chưa
        gán cụm — Kỹ thuật gán ở hồ sơ SP
      </span>,
    )
  if (d.jobsTre > 0)
    items.push(
      <span key="tre" className="stop">
        <b className="num">{d.jobsTre}</b> việc trễ hạn tổ
        <button
          type="button"
          className="lnk"
          onClick={() => d.setTab('ke_hoach')}
          style={{ marginLeft: 6 }}
        >
          Kế hoạch tổ &amp; hạn
        </button>
      </span>,
    )
  if (d.tonCongDoan > 0)
    items.push(
      <span key="ton">
        <b className="num">{fmt(d.tonCongDoan)}</b> tồn tại công đoạn chưa giao đi
        {d.pgtChoNhan > 0 && ` · ${d.pgtChoNhan} phiếu chờ nhận`}
        {p.canRecord && (
          <Link
            className="lnk"
            href={`/thongke/giao-nhan?lsx=${data.lsx.id}`}
            style={{ marginLeft: 6 }}
          >
            Giao nhận
          </Link>
        )}
      </span>,
    )
  if (items.length === 0) return null
  return <div className="sx-note sx-vpl">{items}</div>
}
