'use client'

import type { DonCtx } from './useDonChungTu'

/*
  Ô SHOP của đơn mua trên sàn (0279, bản vẽ "Đơn mua trên sàn" khung 1, duyệt 27/10/2026).

  Nằm TRONG chip NCC, chỉ hiện khi NCC là sàn: NCC thật của đơn là shop, Shopee chỉ là
  chỗ mua. Gõ tự do — shop đổi liên tục, lập danh mục shop là việc không ai làm — kèm
  gợi ý tên đã mua trên chính sàn đó (`datalist`: chữ đang gõ luôn được giữ, kể cả khi
  bấm Tab đi, khác ô chọn `ChonNhom` chỉ nhận dòng có sẵn).

  Lưu nháp không bắt; GỬI DUYỆT mới bắt (server `guiDuyetSanLoi`), chân đơn nhắc trước.
*/

/** aria-label của ô — chân đơn tìm theo nhãn này để đưa con trỏ về. */
export const O_SHOP_LABEL = 'Tên shop'

/** Đơn đang soạn cho một sàn mà chưa có tên shop. */
export function thieuShop(d: DonCtx): boolean {
  return !!d.supplierOpt?.is_marketplace && !d.header.marketplaceShop?.trim()
}

export function OShop({ d }: { d: DonCtx }) {
  const { header, setHeader } = d
  const goiY = (d.p.shopGoiY ?? []).filter((s) => s.supplier_id === header.supplierId)
  const listId = `shop-goi-y-${header.supplierId}`
  const trong = !header.marketplaceShop?.trim()
  return (
    <span className="flex items-center gap-1.5 border-l border-[var(--hair)] pl-2">
      <span
        className={`px-1 text-[10px] font-bold ${trong ? 'bg-[var(--stop-wash)] text-[var(--stop)]' : 'bg-[#eceff3] text-[var(--ink-2)]'}`}
      >
        SHOP *
      </span>
      <input
        aria-label={O_SHOP_LABEL}
        list={listId}
        placeholder="Tên shop bán…"
        className="w-[190px] bg-transparent text-[13px] outline-none"
        value={header.marketplaceShop ?? ''}
        onChange={(e) => setHeader((h) => ({ ...h, marketplaceShop: e.target.value }))}
        onBlur={
          (e) =>
          setHeader((h) => ({ ...h, marketplaceShop: e.target.value.trim().replace(/\s+/g, ' ') })) // prettier-ignore
        }
      />
      <datalist id={listId}>
        {goiY.map(
          (s) =>
          <option key={s.shop} value={s.shop} label={`${s.n} đơn · gần nhất ${s.last.slice(8, 10)}/${s.last.slice(5, 7)}`} />, // prettier-ignore
        )}
      </datalist>
    </span>
  )
}
