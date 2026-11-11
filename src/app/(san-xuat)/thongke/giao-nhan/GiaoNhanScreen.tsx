'use client'

import {
  ApNhom,
  ApNut,
  DauTrang,
  SxKhung,
  TabNgang,
  ThanhTT,
} from '@/app/(workspace)/production/_erp/khung'
import { cx, TAB_LABEL, TABS, type Payload } from './giao-nhan.shared'
import { BangPhieu } from './bang-phieu'
import { LapPhieu } from './lap-phieu'
import { useGiaoNhan } from './useGiaoNhan'

/**
 * GIAO NHẬN BÁN THÀNH PHẨM — màn S5 của bản vẽ 03/11/2026
 * (https://claude.ai/artifact/4VNmsX9hoLFmgic9AGrCci), B4 của
 * docs/san-xuat-cau-hinh-thiet-ke.md. KHÔNG kit — khung `_erp` của Sản xuất.
 *
 * Thống kê tổ — "tổ tôi giao gì, nhận gì, còn chờ nhận gì?". Phiếu giao tổ
 * (PGT) hai nhịp: tổ giao lập → tổ nhận xác nhận; chênh bắt lý do; đã nhận
 * không sửa, chỉ đảo; huỷ khi chưa nhận. Tồn công đoạn và khả dụng suy từ đây
 * (lib/wip-numbers — cùng hàm với Ghi sản lượng).
 */
export function GiaoNhanScreen({ data }: { data: Payload }) {
  const d = useGiaoNhan(data)
  const { p } = d
  const choNhan = d.counts.cho_nhan
  const daGiao = d.counts.da_giao

  return (
    <SxKhung bare label="Giao nhận">
      <div className="sx-body">
        <DauTrang
          crumb="Ghi sổ"
          title="Giao nhận"
          ctx={
            d.team ? (
              <>
                tổ của tôi: <b>{d.team.name}</b>
                {d.team.stage_code && <> · công đoạn {d.stageLabel(d.team.stage_code)}</>}
              </>
            ) : (
              'chưa chọn tổ'
            )
          }
          actions={
            <>
              <ApNhom>
                <ApNut href="/thongke/ghi">Ghi sản lượng</ApNut>
              </ApNhom>
              <ApNhom>
                <ApNut
                  primary
                  onClick={d.moForm ? () => d.setMoForm(false) : d.moLapPhieu}
                >
                  {d.moForm ? 'Đóng bảng lập phiếu' : '＋ Lập phiếu giao'}
                </ApNut>
              </ApNhom>
            </>
          }
        />

        <TabNgang
          label="Phiếu giao tổ"
          tabs={TABS.map((t) => ({
            key: t,
            label: TAB_LABEL[t],
            n: d.counts[t],
            on: d.tab === t,
            onClick: () => d.setTab(t),
          }))}
        />

        <div className="sx-hc">
          <label className="c">
            Lệnh
            <select
              value={d.lsxLoc}
              onChange={(e) => d.setLsxLoc(e.target.value)}
              aria-label="Lọc lệnh"
            >
              <option value="">tất cả</option>
              {p.lsx.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code}
                </option>
              ))}
            </select>
          </label>
          <label className="c">
            Tổ
            <select
              value={d.teamId}
              onChange={(e) => d.doiTeam(e.target.value)}
              aria-label="Tổ đang đứng"
            >
              <option value="">— chọn tổ —</option>
              {p.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.id === p.me?.team_id ? ' (tổ tôi)' : ''}
                </option>
              ))}
            </select>
          </label>
          <span className="sp mut">
            Chênh lệch bắt lý do · phiếu đã nhận không sửa, chỉ đảo
          </span>
        </div>

        {d.loi && <div className="sx-err">{d.loi}</div>}
        {d.thongBao && !d.loi && (
          <div className="sx-note ok">
            {d.thongBao}
            <button type="button" className="lnk mut" onClick={() => d.setThongBao(null)}>
              Đóng
            </button>
          </div>
        )}
        {d.hoi && (
          <div className={cx('sx-note', d.hoi.kind === 'huy' && 'stop')}>
            <b>
              {d.hoi.kind === 'huy' ? 'Huỷ' : 'Đảo'} {d.hoi.doc.doc_no}
            </b>
            {d.hoi.kind === 'huy'
              ? ' — phiếu chưa được nhận, huỷ sẽ giữ lại dấu vết, không xoá.'
              : ' — lập phiếu ngược trả trọn số đã nhận về tổ giao; phiếu gốc giữ nguyên.'}
            <input
              className="sx-in"
              value={d.hoi.reason}
              onChange={(e) => d.setHoi({ ...d.hoi!, reason: e.target.value })}
              placeholder="lý do (bắt buộc)"
              aria-label="Lý do"
              style={{ width: 260, marginLeft: 8 }}
              autoFocus
            />
            <button
              type="button"
              className="lnk"
              onClick={d.hoi.kind === 'huy' ? d.huy : d.dao}
              disabled={!d.hoi.reason.trim() || d.busy}
            >
              {d.hoi.kind === 'huy' ? 'Huỷ phiếu' : 'Lập phiếu đảo'}
            </button>
            <button type="button" className="lnk mut" onClick={() => d.setHoi(null)}>
              Thôi
            </button>
          </div>
        )}

        {d.moForm ? (
          <div className="sx-two">
            <BangPhieu d={d} />
            <LapPhieu d={d} />
          </div>
        ) : (
          <BangPhieu d={d} />
        )}

        <ThanhTT
          left={
            <>
              Chờ {d.team?.name ?? 'tổ'} nhận <b>{choNhan}</b> phiếu · đã giao chờ tổ khác
              nhận <b>{daGiao}</b> phiếu
            </>
          }
          right="Không bắt lập phiếu — ghi sổ vẫn được, chỉ cảnh báo vượt khả dụng"
        />
      </div>
    </SxKhung>
  )
}
