'use client'

import {
  Btn,
  Chip,
  FilterBar,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
} from '@/components/kit'
import { THU_TU_MUA, TINH_TRANG_MUA } from '@/lib/lsx-bang-ke-mua'
import type { LsxBangKe } from '@/modules/dept/supply/lsx-bang-ke.service'
import { dmy } from './bang-ke.shared'
import { BangKeLuoi } from './bang-ke-luoi'
import { BangKeChan, BangKeRong } from './bang-ke-chan'
import { useBangKe } from './useBangKe'

/**
 * BẢNG KÊ VẬT TƯ CỦA LỆNH — màn riêng (08/10/2026, bản vẽ
 * https://claude.ai/artifact/4mNRZ1J1ow3RFuotyRxQjW, user duyệt như đề xuất).
 *
 * Câu màn trả lời: LỆNH NÀY CÒN PHẢI MUA GÌ, BAO NHIÊU, ĐỂ LÊN ĐƠN. Khuôn C ·
 * Danh sách, chép Odoo "Replenishment" (Cần / Dự báo / Phải đặt + nút Đặt) và
 * SAP MD04 (nguồn số nói rõ trên từng dòng).
 *
 * Khác chế độ "Theo vật tư" của màn lệnh (bị chê "nhìn rất khó hiểu" vì chỉ bày
 * mã đã có đơn): ở đây CẦN · TỒN · ĐÃ GỬI · NHÁP · CÒN PHẢI ĐẶT là cột chính,
 * dòng chỉ có định mức vẫn bày với tình trạng "Chưa đặt", và tích dòng là lên
 * đơn ngay với SL = còn phải đặt.
 *
 * Số đo lúc dựng: 14 lệnh đang chạy, 1 lệnh (Blackin) tính được bảng kê từ định
 * mức; 0/119 SP được Kỹ thuật kiểm → định mức chưa kiểm MẶC ĐỊNH tính (Q2), có
 * công tắc tắt.
 */
export function BangKeScreen({
  bk,
  canEdit,
  includeDraft,
}: {
  bk: LsxBangKe
  canEdit: boolean
  includeDraft: boolean
}) {
  const d = useBangKe({ bk, canEdit, includeDraft })
  const { lsx } = bk
  const soSp = bk.products.reduce((s, p) => s + p.qty, 0)
  const kiem = bk.products.filter((p) => p.bom_confirmed).length
  const rong = d.canMua === 0 && bk.manual_count === 0
  const nhanDon = d.daChon.length > 0 ? `Lên đơn · ${d.daChon.length} mã` : 'Lên đơn'

  return (
    <ScreenFrame tableMin={820}>
      <ScreenHeader
        eyebrow="Mua hàng · Bảng kê vật tư"
        title={lsx.code}
        facts={[
          {
            label: 'Sản phẩm',
            value: `${bk.products.length} · ${soSp.toLocaleString('vi-VN')} cái`,
          },
          { label: 'Xuất', value: dmy(lsx.ship_date) },
          { label: 'Mốc vật tư', value: dmy(lsx.materials_due_at) },
          // SÁU DỮ KIỆN ĐƯA ĐI ĐƯỢC — bấm là lọc bảng xuống đúng chừng ấy dòng
          // (kit: `facts` có `onClick`), thay cho dải ô đếm riêng.
          { label: 'Cần mua', value: `${d.canMua} mã`, onClick: () => d.setLoc(d.loc === 'can' ? null : 'can'), on: d.loc === 'can' }, // prettier-ignore
          { label: 'Chưa đặt', value: `${d.dem.chua_dat}`, tone: d.dem.chua_dat > 0 ? 'stop' : undefined, onClick: () => d.setLoc(d.loc === 'chua_dat' ? null : 'chua_dat'), on: d.loc === 'chua_dat' }, // prettier-ignore
          { label: 'Nháp thiếu', value: `${d.dem.nhap_thieu}`, tone: d.dem.nhap_thieu > 0 ? 'warn' : undefined, onClick: () => d.setLoc(d.loc === 'nhap_thieu' ? null : 'nhap_thieu'), on: d.loc === 'nhap_thieu' }, // prettier-ignore
          { label: 'Đủ trên nháp', value: `${d.dem.du_nhap}`, onClick: () => d.setLoc(d.loc === 'du_nhap' ? null : 'du_nhap'), on: d.loc === 'du_nhap' }, // prettier-ignore
          { label: 'Đã về đủ', value: `${d.dem.da_ve}`, onClick: () => d.setLoc(d.loc === 'da_ve' ? null : 'da_ve'), on: d.loc === 'da_ve' }, // prettier-ignore
          { label: 'Chưa quy đổi được', value: `${bk.blocked.length} dòng`, tone: bk.blocked.length > 0 ? 'warn' : undefined, onClick: d.toiChan, on: d.moChan }, // prettier-ignore
        ]}
        actions={
          <>
            <Btn icon="lenh" href={`/mua-hang/yeu-cau/${lsx.id}`}>
              Lệnh
            </Btn>
            <Btn
              icon="excel"
              href={`/api/dept/supply/lsx-report?lsx=${lsx.id}&loai=bangke&nhap=${includeDraft ? '1' : '0'}`}
            >
              Excel bảng kê
            </Btn>
            {canEdit && (
              <Btn
                icon="them"
                primary
                onClick={d.lenDon}
                disabled={!d.hrefDon}
                title={
                  d.hrefDon
                    ? 'Mở màn soạn đơn với SL = còn phải đặt'
                    : 'Tích dòng còn phải đặt trước'
                }
              >
                {nhanDon}
              </Btn>
            )}
          </>
        }
      >
        {/* NGUỒN SỐ — ngay dưới đầu trang: số Cần đến từ đâu và còn thiếu gì để
            tin được. Không giấu vào tooltip. */}
        <div className="text-k-sm flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5 text-[var(--ink-2)]">
          <span>
            Nguồn số Cần: định mức của <b>{bk.products.length} SP</b> × SL lệnh, Kỹ thuật
            đã kiểm{' '}
            <b>
              {kiem}/{bk.products.length}
            </b>
            .
          </span>
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={includeDraft}
              onChange={(e) => d.doiNhap(e.target.checked)}
              className="accent-[var(--act)]"
            />
            Tính cả định mức chưa kiểm
          </label>
          <span>Tồn = tồn kho − đã giữ cho lệnh khác.</span>
          <span>Còn phải đặt = Cần − Tồn − Đã gửi NCC − Nháp.</span>
          {bk.unsplit_pos.length > 0 && (
            <span className="text-[var(--warn)]">
              {bk.unsplit_pos.length} đơn gộp lệnh chưa chia số (
              {bk.unsplit_pos.map((p) => p.po_code).join(', ')}) — phần của lệnh này đang
              tính 0.
            </span>
          )}
          {bk.manual_error && (
            <span className="text-[var(--warn)]">
              Chưa đọc được dòng nhập tay: {bk.manual_error}
            </span>
          )}
        </div>
      </ScreenHeader>

      {rong ? (
        <BangKeRong bk={bk} />
      ) : (
        <>
          <FilterBar dense label="Lọc bảng kê theo tình trạng, nhóm và tìm mã">
            <Chip
              on={d.loc === null}
              count={d.tatCa.length}
              onClick={() => d.setLoc(null)}
            >
              Tất cả
            </Chip>
            {THU_TU_MUA.filter((t) => d.dem[t] > 0).map((t) => (
              <Chip
                key={t}
                on={d.loc === t}
                count={d.dem[t]}
                onClick={() => d.setLoc(d.loc === t ? null : t)}
              >
                {TINH_TRANG_MUA[t].label}
              </Chip>
            ))}
            {d.nhoms.length > 1 && (
              <select
                aria-label="Lọc theo nhóm vật tư"
                value={d.nhom ?? ''}
                onChange={(e) => d.setNhom(e.target.value || null)}
                className="text-k-sm ml-2 border border-[var(--line)] bg-[var(--surface-card)] px-1.5 py-0.5 text-[var(--ink)]"
              >
                <option value="">Nhóm: tất cả</option>
                {d.nhoms.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            )}
            <div className="ml-auto">
              <SearchInput
                value={d.q}
                onChange={d.setQ}
                placeholder="Tìm mã, tên vật tư…"
                width={240}
              />
            </div>
          </FilterBar>
          <BangKeLuoi d={d} />
          <BangKeChan d={d} />
        </>
      )}
    </ScreenFrame>
  )
}
