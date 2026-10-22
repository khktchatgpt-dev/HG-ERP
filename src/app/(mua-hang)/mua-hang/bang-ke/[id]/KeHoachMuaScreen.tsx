'use client'

import { THU_TU_MUA, TINH_TRANG_MUA } from '@/lib/lsx-bang-ke-mua'
import type { LsxBangKe } from '@/modules/dept/supply/lsx-bang-ke.service'
import { ChipLoc, ChonLoc, DauTrang, HangLoc, Nut, ThanhDuoi, Trang } from '../../_erp/ui'
import { DanBangKe } from './dan-bang-ke'
import { dmy, so0 } from './ke-hoach.shared'
import { NhuCau } from './nhu-cau'
import { useKeHoachMua, type Buoc, type KeHoachCtx } from './useKeHoachMua'

/**
 * KẾ HOẠCH MUA THEO LỆNH — thay màn "Bảng kê vật tư" (bản vẽ
 * https://claude.ai/artifact/WE12EjR59Qj1WNVaPXmzXu, duyệt 22/10/2026, Q1–Q6
 * theo đề xuất). KHÔNG dùng kit: khối `_erp/ui` của khu Mua hàng + token.
 *
 * Câu màn trả lời: LỆNH NÀY CÒN PHẢI MUA GÌ, MUA CỦA AI, GIÁ BAO NHIÊU — VÀ LÊN
 * ĐƠN LUÔN. Hôm nay NV Cung ứng làm 3 việc ngoài app (bảng kê Excel từ file BOM
 * → so giá → chia NCC) rồi mới vào gõ đơn; màn này gom cả 3 thành 3 bước trên
 * một lưới. Chép SAP ME57 (gán nguồn cho đề nghị mua rồi tạo PO theo NCC) và
 * Odoo Replenishment.
 *
 * Số đo lúc dựng (22/10): 17 lệnh đang chạy, định mức chỉ 16% dòng gắn mã, 0 SP
 * Kỹ thuật đã kiểm, 5/17 lệnh máy tính ra số cần → bước 1 NHẬN BẢNG KÊ DÁN VÀO
 * cho phần định mức thiếu, không bắt chờ.
 */
export function KeHoachMuaScreen({
  bk,
  canEdit,
  includeDraft,
  buocDau,
}: {
  bk: LsxBangKe
  canEdit: boolean
  includeDraft: boolean
  buocDau: Buoc
}) {
  const d = useKeHoachMua({ bk, canEdit, includeDraft, buocDau })
  const { lsx } = bk
  return (
    <Trang>
      <DauTrang
        eyebrow="Mua hàng · Kế hoạch mua"
        title={<span className="font-mono">{lsx.code}</span>}
        actions={
          <>
            <Nut href={`/mua-hang/yeu-cau/${lsx.id}`}>Lệnh</Nut>
            <Nut
              href={`/api/dept/supply/lsx-report?lsx=${lsx.id}&loai=bangke&nhap=${includeDraft ? '1' : '0'}`}
            >
              Xuất Excel
            </Nut>
            {canEdit && (
              <Nut chinh onClick={() => d.setMoDan(true)}>
                Dán bảng kê
              </Nut>
            )}
          </>
        }
        facts={[
          { k: 'Khách', v: lsx.customer_name || '—' },
          { k: 'Đơn khách', v: lsx.order_codes.join(', ') || '—' },
          { k: 'Ngày xuất', v: dmy(lsx.ship_date) },
          { k: 'Mốc vật tư', v: dmy(lsx.materials_due_at) },
          {
            k: 'Sản phẩm',
            v: `${bk.products.length} · ${so0(bk.products.reduce((s, p) => s + p.qty, 0))} cái`,
          },
        ]}
      />
      <DaiBuoc d={d} />
      {d.buoc === 1 && (
        <>
          <LocNhuCau d={d} />
          <NhuCau d={d} />
        </>
      )}
      <ThanhDuoi
        left={
          <>
            <span>Tồn = tồn kho − đã giữ cho lệnh khác.</span>
            <span>Số nhập tay thay định mức của đúng mã đó; lệch &gt; 10% tô cam.</span>
            {bk.unsplit_pos.length > 0 && (
              <span className="text-[var(--warn)]">
                {bk.unsplit_pos.length} đơn gộp lệnh chưa chia số (
                {bk.unsplit_pos.map((p) => p.po_code).join(', ')}) — phần của lệnh này
                đang tính 0.
              </span>
            )}
            {bk.manual_error && (
              <span className="text-[var(--stop)]">
                Chưa đọc được số nhập tay: {bk.manual_error}
              </span>
            )}
          </>
        }
      />
      {d.moDan && <DanBangKe d={d} />}
    </Trang>
  )
}

/** Dải 3 bước — mỗi bước một con số nói còn việc gì. */
function DaiBuoc({ d }: { d: KeHoachCtx }) {
  const buoc: { k: Buoc; t: string; s: string; khoa?: string }[] = [
    {
      k: 1,
      t: 'Nhu cầu',
      s: `${d.conDat.length} mã còn phải đặt · ${d.soTay} mã nhập tay${d.lechTay ? ` (${d.lechTay} lệch định mức)` : ''}`,
    },
    { k: 2, t: 'Chọn NCC', s: 'Gợi ý NCC + giá cho từng mã', khoa: 'Đang dựng' },
    { k: 3, t: 'Lên đơn', s: 'Mỗi NCC một đơn nháp', khoa: 'Đang dựng' },
  ]
  return (
    <div
      role="tablist"
      aria-label="Các bước kế hoạch mua"
      className="flex shrink-0 border-b border-[var(--line)] bg-[var(--surface-card)]"
    >
      {buoc.map((b) => {
        const on = d.buoc === b.k
        return (
          <button
            key={b.k}
            type="button"
            role="tab"
            aria-selected={on}
            aria-disabled={b.khoa ? true : undefined}
            title={b.khoa}
            onClick={() => !b.khoa && d.setBuoc(b.k)}
            className={`grid min-w-0 flex-1 gap-0.5 border-r border-b-[3px] border-r-[var(--hair)] px-4 py-2 text-left last:border-r-0 ${on ? 'border-b-[var(--act)] bg-[var(--act-wash)]' : 'border-b-transparent hover:bg-[var(--surface-hover)]'} ${b.khoa ? 'cursor-not-allowed opacity-70' : ''}`}
          >
            <span className="flex items-center gap-2 font-semibold">
              <span
                className={`inline-grid size-5 place-items-center rounded-full border font-mono text-[11px] ${on ? 'border-[var(--act)] bg-[var(--act)] text-white' : 'border-[var(--line)] text-[var(--ink-3)]'}`}
              >
                {b.k}
              </span>
              {b.t}
              {b.khoa && (
                <span className="text-[11px] font-normal text-[var(--ink-3)]">
                  · {b.khoa}
                </span>
              )}
            </span>
            <span className="truncate text-[12px] text-[var(--ink-3)]">{b.s}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Hàng lọc của bước 1: tình trạng · nhập tay · nhóm · tìm. */
function LocNhuCau({ d }: { d: KeHoachCtx }) {
  if (d.tatCa.length === 0) return null
  return (
    <HangLoc>
      <ChipLoc on={d.loc === null} count={d.tatCa.length} onClick={() => d.setLoc(null)}>
        Tất cả
      </ChipLoc>
      <ChipLoc
        on={d.loc === 'con_dat'}
        count={d.conDat.length}
        onClick={() => d.setLoc(d.loc === 'con_dat' ? null : 'con_dat')}
      >
        Còn phải đặt
      </ChipLoc>
      {d.soTay > 0 && (
        <ChipLoc
          on={d.loc === 'tay'}
          count={d.soTay}
          onClick={() => d.setLoc(d.loc === 'tay' ? null : 'tay')}
        >
          Nhập tay
        </ChipLoc>
      )}
      {THU_TU_MUA.filter((t) => d.dem[t] > 0).map((t) => (
        <ChipLoc
          key={t}
          on={d.loc === t}
          count={d.dem[t]}
          onClick={() => d.setLoc(d.loc === t ? null : t)}
        >
          {TINH_TRANG_MUA[t].label}
        </ChipLoc>
      ))}
      {d.bk.blocked.length > 0 && (
        <button
          type="button"
          onClick={d.toiChan}
          className="text-[12px] font-semibold text-[var(--stop)] underline-offset-2 hover:underline"
        >
          {d.bk.blocked.length} dòng chưa quy đổi được
        </button>
      )}
      <span className="ml-auto flex items-center gap-2">
        {d.nhoms.length > 1 && (
          <ChonLoc
            label="Nhóm"
            value={d.nhom ?? ''}
            onChange={(v) => d.setNhom(v || null)}
            options={[
              { value: '', label: 'tất cả' },
              ...d.nhoms.map((n) => ({ value: n, label: n })),
            ]}
          />
        )}
        <input
          type="search"
          aria-label="Tìm mã, tên vật tư"
          placeholder="Tìm mã, tên vật tư…"
          value={d.q}
          onChange={(e) => d.setQ(e.target.value)}
          className="w-[220px] rounded-[3px] border border-[var(--line)] bg-[var(--surface-card)] px-2 py-[4px] text-[12.5px] outline-none focus:border-[var(--act)]"
        />
      </span>
    </HangLoc>
  )
}
