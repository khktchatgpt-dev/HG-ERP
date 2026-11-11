'use client'

import {
  ApNhom,
  ApNut,
  DauTrang,
  SxKhung,
  TabNgang,
  ThanhTT,
} from '@/app/(workspace)/production/_erp/khung'
import { dmy, TAB_LABEL, TABS, type Payload, type TabKey } from './bao-cao.shared'
import {
  BangDinhMuc,
  BangLoi,
  BangNangSuat,
  BangSanLuongTo,
  BangSuaLaiTreo,
  BangTonCongDoan,
} from './bang-bao-cao'
import { useBaoCao } from './useBaoCao'

/**
 * BÁO CÁO SẢN XUẤT — màn S6 của bản vẽ 03/11/2026
 * (https://claude.ai/artifact/4VNmsX9hoLFmgic9AGrCci), B6 của
 * docs/san-xuat-cau-hinh-thiet-ke.md. KHÔNG kit.
 *
 * Quản đốc / Giám đốc — "tuần này tổ nào đạt chỉ tiêu, lỗi nào nhiều nhất, hàng
 * sửa lại còn treo bao nhiêu, kẹt ở công đoạn nào?". Sáu bảng, một kỳ tự do
 * (trần 92 ngày), lọc tổ; kỳ nằm trên URL nên gửi link là gửi đúng báo cáo.
 */
export function BaoCaoScreen({
  data,
  initialTab,
}: {
  data: Payload
  initialTab: TabKey | null
}) {
  const d = useBaoCao(data, initialTab)
  const { p } = d
  const teamsCoSo = new Set(p.san_luong_to.map((r) => r.team_id)).size
  const excelType =
    d.tab === 'to'
      ? 'san-luong'
      : d.tab === 'loi'
        ? 'phe'
        : d.tab === 'nang_suat'
          ? 'nang-suat'
          : d.tab === 'treo' || d.tab === 'ton'
            ? d.tab
            : null
  const n: Partial<Record<TabKey, number>> = {
    loi: p.loi.length,
    treo: p.sua_lai_treo.length,
    ton: p.ton_cong_doan.length,
    nang_suat: p.nang_suat_to.length,
  }

  return (
    <SxKhung bare label="Báo cáo sản xuất">
      <div className="sx-body">
        <DauTrang
          crumb="Xem"
          title="Báo cáo"
          ctx={
            <>
              kỳ{' '}
              <b>
                {dmy(p.from)} – {dmy(p.to)}
              </b>{' '}
              · {p.days.length} ngày · {teamsCoSo} tổ có sổ
            </>
          }
          actions={
            <>
              <ApNhom>
                <ApNut onClick={() => d.kyNhanh(7)}>7 ngày</ApNut>
                <ApNut onClick={() => d.kyNhanh(30)}>30 ngày</ApNut>
                <ApNut onClick={d.thangNay}>Tháng này</ApNut>
              </ApNhom>
              <ApNhom>
                {excelType ? (
                  <ApNut href={d.excelHref(excelType)}>Tải Excel</ApNut>
                ) : (
                  <ApNut why="Bảng này chưa có Excel">Tải Excel</ApNut>
                )}
              </ApNhom>
            </>
          }
        />

        <div className="sx-hc">
          <label className="c">
            Từ
            <input
              type="date"
              value={d.from}
              max={d.to}
              onChange={(e) => d.setFrom(e.target.value)}
              aria-label="Từ ngày"
            />
          </label>
          <label className="c">
            Đến
            <input
              type="date"
              value={d.to}
              min={d.from}
              max={p.today}
              onChange={(e) => d.setTo(e.target.value)}
              aria-label="Đến ngày"
            />
          </label>
          <label className="c">
            Tổ
            <select
              value={d.team}
              onChange={(e) => d.setTeam(e.target.value)}
              aria-label="Lọc tổ"
            >
              <option value="">tất cả</option>
              {p.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="sx-btn p" onClick={() => d.apDung()}>
            Xem
          </button>
          <span className="sp mut">
            Tồn công đoạn và Sửa lại treo là HIỆN TRẠNG, không theo kỳ
          </span>
        </div>

        <TabNgang
          label="Báo cáo"
          tabs={TABS.map((t) => ({
            key: t,
            label: TAB_LABEL[t],
            n: n[t],
            on: d.tab === t,
            onClick: () => d.moTab(t),
          }))}
        />

        {d.loi && <div className="sx-err">{d.loi}</div>}

        {d.tab === 'to' && <BangSanLuongTo d={d} />}
        {d.tab === 'loi' && <BangLoi d={d} />}
        {d.tab === 'treo' && <BangSuaLaiTreo d={d} />}
        {d.tab === 'ton' && <BangTonCongDoan d={d} />}
        {d.tab === 'nang_suat' && <BangNangSuat d={d} />}
        {d.tab === 'dinh_muc' && <BangDinhMuc d={d} />}

        <ThanhTT
          left="Sản lượng tính mọi phiếu trong kỳ · tồn công đoạn chỉ đếm phiếu chính thức"
          right="Kỳ tối đa 92 ngày"
        />
      </div>
    </SxKhung>
  )
}
