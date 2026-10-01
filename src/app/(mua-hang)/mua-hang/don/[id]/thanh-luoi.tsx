'use client'

import { Combobox, GridBtn, Menu } from '@/components/kit'
import { api } from '@/lib/api'
import type { PoMaterial } from '@/lib/po-material.types'
import type { DonCtx } from './useDonChungTu'

/**
 * THANH CÔNG CỤ LƯỚI DÒNG HÀNG lúc soạn (tách khỏi dong-hang.tsx 30/09/2026).
 *
 * Bản trước bày 7 nút cùng một kiểu viền xám, kể cả nút đang khoá ("Xoá dòng"
 * khi chưa chọn, "Thêm còn thiếu" khi lệnh không còn gì) — chủ dự án chấm "rất
 * rối". Nay: ô tìm vật tư là việc chính nên đứng đầu; nút chỉ HIỆN khi dùng được
 * (xoá khi đã chọn dòng, thêm còn thiếu khi lệnh còn mã, chia đợt khi chưa chia);
 * ba thao tác ít dùng gom vào menu "Thêm ▾".
 */
export function ThanhLuoi({ d }: { d: DonCtx }) {
  const { sel, addMaterial, addFree, removeSel, setPaste, setQuickAdd } = d
  const { drafting, pending, addFromNeeds, goTo, shipCols, dotMo, setDotMo } = d
  return (
    // Nằm trong hàng tiêu đề khối "Dòng đơn hàng" (actions của FastTab) — không còn hàng riêng.
    <span className="flex flex-wrap items-center gap-1">
      <>
        <Combobox<PoMaterial>
          label="Thêm vật tư"
          placeholder="Gõ mã, tên hoặc quy cách (50x50, 8x15…) rồi Enter"
          width={360}
          search={async (q) =>
            (
              await api<{ materials: PoMaterial[] }>(
                `/api/dept/supply/po-materials?q=${encodeURIComponent(q)}&limit=12`,
              )
            ).materials
          }
          keyOf={(m) => m.id}
          /*
            HAI DÒNG, QUY CÁCH ĐỨNG RIÊNG — quy cách là thứ người mua dùng để
            phân biệt (8 mã "Inox hộp 50x50" khác nhau ở độ dày, 131 mã "Nút
            chân" khác nhau ở kích thước). Tồn kho đi kèm: biết còn 2.000 cái
            thì người mua đặt 500 chứ không đặt 2.500.
          */
          render={(m) => (
            <>
              <span className="flex items-baseline gap-2">
                <span className="num shrink-0 font-semibold text-[var(--act)]">
                  {m.code}
                </span>
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
              </span>
              <span className="text-k-label flex flex-wrap items-baseline gap-x-2.5">
                {m.spec ? (
                  <span className="num font-semibold text-[var(--ink-2)]">{m.spec}</span>
                ) : (
                  <span className="text-[var(--ink-empty)]">chưa có quy cách</span>
                )}
                <span className="text-[var(--ink-3)]">{m.unit}</span>
                {m.on_hand != null && m.on_hand !== 0 && (
                  <span className="num text-[var(--ink-3)]">tồn {m.on_hand}</span>
                )}
                {m.last_purchase_price != null && (
                  <span className="num text-[var(--ink-3)]">
                    giá gần nhất {m.last_purchase_price.toLocaleString('vi-VN')}
                  </span>
                )}
                {m.group_name && (
                  <span className="truncate text-[var(--ink-3)]">{m.group_name}</span>
                )}
              </span>
            </>
          )}
          onPick={addMaterial}
        />
        {sel.length > 0 && (
          <GridBtn onClick={removeSel}>Xoá {sel.length} dòng đã chọn</GridBtn>
        )}
        {drafting && pending.length > 0 && (
          <GridBtn
            title="Thêm mọi mã lệnh còn thiếu vào đơn"
            onClick={() => void addFromNeeds(pending)}
          >
            Thêm {pending.length} mã lệnh còn thiếu
          </GridBtn>
        )}
        {drafting && shipCols.length === 0 && !dotMo && (
          <GridBtn
            title="Chia SL từng dòng theo nhiều ngày giao — đơn giao một lần thì bỏ qua"
            onClick={() => {
              setDotMo(true)
              requestAnimationFrame(() => goTo('dot-giao'))
            }}
          >
            Chia đợt giao
          </GridBtn>
        )}
        <Menu
          label="Thêm ▾"
          ariaLabel="Thêm cách nhập dòng"
          items={[
            { label: 'Dòng tự do (không gắn vật tư)', onClick: addFree },
            { label: 'Dán từ Excel', onClick: () => setPaste(true) },
            { label: 'Khai vật tư mới vào danh mục', onClick: () => setQuickAdd(true) },
          ]}
        />
      </>
    </span>
  )
}
