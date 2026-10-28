'use client'

import { useState } from 'react'
import { isoToVn } from '@/lib/date-vn'
import {
  ChipLoc,
  ChonLoc,
  DauTrang,
  HangLoc,
  INPUT,
  MenuBa,
  Nhan,
  Nut,
  ThanhDuoi,
  Trang,
} from '../_erp/ui'
import { BangTheoMon } from './bang-theo-mon'
import { BangTheoNcc } from './bang-theo-ncc'
import { HopDan } from './hop-dan'
import { HopHoiGia } from './hop-hoi-gia'
import { useTraGia, type Loc } from './useTraGia'
import { KY_OPTS, tien, type Ky } from './tra-gia.shared'

const CHIPS: { id: Loc; label: string; canh?: boolean; anKhiRong?: boolean }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'ok', label: 'So được' },
  { id: 'one', label: 'Một NCC' },
  { id: 'mo_ho', label: 'Cần chọn quy cách', canh: true, anKhiRong: true },
  { id: 'moi', label: 'Món mới' },
  { id: 'trong', label: 'Chưa có giá', canh: true },
  { id: 'chenh', label: 'Chênh > 10%', canh: true },
]

/**
 * TRA GIÁ VẬT TƯ — bản vẽ duyệt 28/10/2026 (https://claude.ai/artifact/5hQcWMCXKLVf24LSGWqLTk).
 *
 * Câu màn trả lời: "Danh sách tôi sắp mua — mỗi món đã mua của NCC nào, giá bao
 * nhiêu, ai rẻ nhất? Món chưa mua bao giờ thì NCC nào bán loại đó?"
 *
 * KHÔNG dùng kit (chủ dự án 28/10): khối `_erp/ui.tsx` của khu Mua hàng +
 * Tailwind, như màn Hạng mục. Giá gom theo QUY CÁCH qua mọi mã / NCC
 * (`lib/tra-gia`), chọn NCC và tổng tiền qua `lib/tra-gia-chon`.
 */
export function TraGiaScreen({ meId }: { meId: string }) {
  const d = useTraGia(meId)
  const [go, setGo] = useState('')
  const coMon = d.mons.length > 0
  const dangTra = d.mons.some((m) => m.dang)
  const them = () => {
    if (!go.trim()) return
    d.them(go)
    setGo('')
  }
  const kyChu = d.meta?.tu_ngay
    ? `${isoToVn(d.meta.tu_ngay)} → ${isoToVn(d.meta.den_ngay)}`
    : d.meta
      ? 'mọi lúc'
      : KY_OPTS.find((o) => o.value === String(d.ky))?.label
  return (
    <Trang>
      <DauTrang
        eyebrow="Mua hàng"
        title="Tra giá vật tư"
        status={<Nhan>nháp trên máy này</Nhan>}
        actions={
          <>
            <Nut onClick={() => d.setHopDan(true)}>Dán từ Excel</Nut>
            <Nut
              chinh
              busy={d.dangXuat}
              khoa={coMon ? undefined : 'Chưa có món nào để xuất. Thêm ít nhất một món.'}
              title="Bảng so sánh giá 3 tờ theo đúng NCC đang chọn — có dòng ký để trình duyệt"
              onClick={() => void d.xuatExcel()}
            >
              Xuất Excel
            </Nut>
            <MenuBa
              items={[
                {
                  label: 'Tra lại giá cả danh sách',
                  onClick: d.traLai,
                  khoa: coMon ? undefined : 'Danh sách đang trống',
                },
                {
                  label: 'Xoá cả danh sách',
                  onClick: d.xoaHet,
                  khoa: coMon ? undefined : 'Danh sách đang trống',
                },
              ]}
            />
          </>
        }
        facts={[
          { k: 'Giá từ', v: `đơn Đã duyệt trở đi · ${kyChu ?? ''}` },
          { k: 'Món', v: String(d.mons.length) },
          {
            k: 'Đã có NCC chọn',
            v: `${d.tong.coChon} / ${d.mons.length}`,
            tone: coMon && d.tong.coChon < d.mons.length ? 'warn' : undefined,
          },
          { k: 'Tổng dự kiến (chưa VAT)', v: `${tien(d.tong.tienChon)} đ` },
        ]}
      />
      <HangLoc>
        <input
          aria-label="Thêm món cần tra giá"
          className={`${INPUT} py-[4px]`}
          // INPUT mang w-full — đặt bề rộng bằng style để không đánh nhau với lớp đó.
          style={{ width: 280 }}
          value={go}
          placeholder="Thêm món: gõ tên, quy cách hoặc mã rồi Enter"
          onChange={(e) => setGo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && them()}
        />
        {coMon &&
          CHIPS.filter((c) => !c.anKhiRong || d.dem_loc[c.id] > 0).map((c) => (
            <ChipLoc
              key={c.id}
              on={d.loc === c.id}
              count={d.dem_loc[c.id]}
              onClick={() => d.setLoc(c.id)}
            >
              {c.canh && d.dem_loc[c.id] > 0 && d.loc !== c.id ? (
                <span className="text-[var(--warn)]">{c.label}</span>
              ) : (
                c.label
              )}
            </ChipLoc>
          ))}
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <ChonLoc
            label="Kỳ giá"
            value={String(d.ky)}
            onChange={(v) => d.doiKy(Number(v) as Ky)}
            options={KY_OPTS}
          />
          <ChipLoc on={d.view === 'mon'} onClick={() => d.setView('mon')}>
            Theo món
          </ChipLoc>
          <ChipLoc on={d.view === 'ncc'} onClick={() => d.setView('ncc')}>
            Theo NCC
          </ChipLoc>
          {d.view === 'mon' && (
            <ChipLoc on={d.chiChon} onClick={() => d.setChiChon(!d.chiChon)}>
              Chỉ NCC chọn
            </ChipLoc>
          )}
        </span>
      </HangLoc>

      <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
        {!coMon ? (
          <div className="grid max-w-[640px] gap-2 px-6 py-8 text-[13px] text-[var(--ink-2)]">
            <b className="text-[14px] text-[var(--ink)]">Danh sách tra giá đang trống</b>
            <p className="m-0">
              Dán cột tên vật tư (kèm SL nếu có) từ file đề nghị mua hoặc bảng kê lệnh,
              hoặc gõ từng món ở ô “Thêm món”. Mỗi món sẽ ra các NCC đã từng bán, giá gần
              nhất và ai rẻ nhất — gom theo quy cách, nên 5 mã nhôm cùng cỡ của 3 NCC vẫn
              so được với nhau.
            </p>
            <span className="flex gap-1.5">
              <Nut chinh onClick={() => d.setHopDan(true)}>
                Dán từ Excel
              </Nut>
            </span>
          </div>
        ) : d.view === 'mon' ? (
          <BangTheoMon d={d} />
        ) : (
          <BangTheoNcc d={d} />
        )}
      </div>
      <ThanhDuoi
        left={
          <>
            <span>
              {d.view === 'mon' ? 'Theo món' : 'Theo nhà cung cấp'}
              {d.loc !== 'all' ? ' · đang lọc' : ''}
            </span>
            {dangTra && <span>Đang tra giá…</span>}
            <span>Nháp tự lưu trên máy này — giá luôn tra lại khi mở</span>
          </>
        }
        right={
          d.meta
            ? `Nguồn: ${d.meta.so_dong.toLocaleString('vi-VN')} dòng đơn mua trong kỳ — không phải bảng giá khai tay`
            : undefined
        }
      />
      {d.hopDan && <HopDan d={d} />}
      {d.hoiMon && <HopHoiGia key={d.hoiMon.m.id} d={d} t={d.hoiMon} />}
    </Trang>
  )
}
