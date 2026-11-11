'use client'

import {
  ApNhom,
  ApNut,
  DauTrang,
  SxKhung,
  TabNgang,
  ThanhTT,
} from '@/app/(workspace)/production/_erp/khung'
import { DocNotesPanel } from '@/components/doc/DocNotesPanel'
import { isStale } from '@/lib/lsx-holder'
import { cx, dmy, fmt, STATUS_LABEL, TAB_LABEL, TABS } from './ho-so-lenh.shared'
import { BangDongBo, DaiNamSo } from './bang-dong-bo'
import { KhoiLuong } from './khoi-luong'
import { TabKeHoach } from './tab-ke-hoach'
import { TabPhieu } from './tab-phieu'
import { useHoSoLenh, type HoSoLenhProps } from './useHoSoLenh'

/**
 * HỒ SƠ LỆNH — màn S3 của bản vẽ 03/11/2026
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
              {lsx.customer_name}
              {lsx.order_codes.length > 0 && (
                <>
                  {' '}
                  · Đơn <b>{lsx.order_codes.join(' · ')}</b>
                </>
              )}
              {lsx.ship_date && (
                <>
                  {' '}
                  · hạn xuất <b>{dmy(lsx.ship_date)}</b>
                  {d.shipLeft != null && (
                    <span
                      className={cx(
                        d.shipLeft < 0 ? 'stop' : d.shipLeft <= 7 ? 'warn' : undefined,
                      )}
                    >
                      {' '}
                      (
                      {d.shipLeft < 0
                        ? `trễ ${-d.shipLeft} ngày`
                        : d.shipLeft === 0
                          ? 'hôm nay'
                          : `còn ${d.shipLeft} ngày`}
                      )
                    </span>
                  )}
                </>
              )}
              {lsx.approved_at && <> · duyệt {dmy(lsx.approved_at)}</>}
              {' · '}
              <span
                className={cx('pill', holder.closed ? 'd' : isStale(holder) ? 'w' : 'm')}
              >
                {STATUS_LABEL[lsx.status] ?? lsx.status}
                {!holder.closed &&
                  holder.days != null &&
                  ` · ${holder.who} giữ ${holder.days} ngày${isStale(holder) ? ' · nằm im' : ''}`}
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
                <ApNut href={`/thongke/lo-trinh?lsx=${lsx.id}`}>Lộ trình công đoạn</ApNut>
                {p.canRecord && (
                  <ApNut href={`/thongke/lsx/${lsx.id}/dinh-hinh`}>Bảng chi tiết</ApNut>
                )}
                <ApNut href={`/api/dept/production/lsx/${lsx.id}/export`}>Excel</ApNut>
              </ApNhom>
              {d.closable && (
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
            <div className="sx-tiles">
              <div className="sx-tile">
                <span className="d">SL đặt</span>
                <span className="v">{fmt(d.tongDat)}</span>
                <span className="s">{data.lines.length} dòng SP</span>
              </div>
              <div className={cx('sx-tile', d.soDinhHinh < data.lines.length && 'w')}>
                <span className="d">Đã định hình</span>
                <span className="v">
                  {d.soDinhHinh} / {data.lines.length}
                </span>
                <span className="s">
                  {fmt(d.soChiTiet)} chi tiết
                  {data.unshaped > 0 && ` · ${data.unshaped} dòng chờ định mức`}
                </span>
              </div>
              <div className={cx('sx-tile', d.hoanThien === 0 && 'zero')}>
                <span className="d">Hoàn thiện</span>
                <span className="v">{fmt(d.hoanThien)}</span>
                <span className="s">/ {fmt(d.tongDat)} bộ · đếm ở công đoạn cuối</span>
              </div>
              <div className={cx('sx-tile', d.tonCongDoan === 0 && 'zero')}>
                <span className="d">Tồn tại công đoạn</span>
                <span className="v">{fmt(d.tonCongDoan)}</span>
                <span className="s">chưa giao đi · {d.pgtChoNhan} chờ nhận</span>
              </div>
              <div className={cx('sx-tile', d.jobsTre > 0 ? 's' : 'zero')}>
                <span className="d">Việc trễ hạn tổ</span>
                <span className="v">{fmt(d.jobsTre)}</span>
                <span className="s">
                  {data.jobs.length === 0
                    ? 'chưa có kế hoạch để trễ'
                    : `/ ${data.jobs.length} việc`}
                </span>
              </div>
            </div>
            <KhoiLuong d={d} />
            <div className="sx-hc">
              <label className="c">
                <input
                  type="checkbox"
                  checked={d.chiDinhHinh}
                  onChange={(e) => d.setChiDinhHinh(e.target.checked)}
                />
                Chỉ dòng đã định hình <b>{d.soDinhHinh}</b>
              </label>
              <label className="c">
                SP
                <select
                  value={d.spLoc}
                  onChange={(e) => d.setSpLoc(e.target.value)}
                  aria-label="Lọc SP"
                >
                  <option value="">tất cả</option>
                  {data.lines.map((l) => (
                    <option key={l.order_line_id} value={l.order_line_id}>
                      {l.product_code}
                    </option>
                  ))}
                </select>
              </label>
              <span className="mut">
                ▸ bung chi tiết trong cụm · ô gạch chéo = ngoài lộ trình
              </span>
              <span className="sp mut">bấm ô để xem năm con số</span>
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

        <ThanhTT
          left={
            holder.closed ? (
              <>Lệnh đã khép — {holder.what}</>
            ) : (
              <>
                Đang chờ <b>{holder.who}</b>
                {holder.days != null && ` · ${holder.days} ngày`} — {holder.what}
              </>
            )
          }
          right="Cùng số với Ghi sản lượng và Giao nhận"
        />
      </div>
    </SxKhung>
  )
}
