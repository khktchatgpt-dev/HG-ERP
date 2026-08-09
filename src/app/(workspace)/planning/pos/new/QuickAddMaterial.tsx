'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/erp/Spinner'
import { invalidateMaterialPickCache } from '@/components/supply/MaterialPicker'
import {
  MaterialCoreFields,
  useMaterialCore,
} from '@/components/warehouse/MaterialCoreFields'
import type { PoTemplate } from '@/lib/po-template'

export type CreatedMaterial = {
  id: string
  code: string
  name: string
  unit: string
  spec: string | null
  group_name: string | null
  sub_group: string | null
  price_unit: string | null
  unit2_factor: number | null
  /*
   * Barem ĐỌC LẠI TỪ SERVER chứ không suy ở client — lấy đúng số server vừa ghi
   * thì server có nuốt trường nào là thấy lệch ngay, không đợi tới lần đặt sau.
   */
  kg_per_m: number | null
  kg_per_unit: number | null
  default_bar_length_m: number | null
  /** Đóng gói mua + vật liệu (0124) — dòng đơn đọc để quy đổi bao và điền cột. */
  pack_size: number | null
  pack_unit: string | null
  material_grade: string | null
}

const cls =
  'w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

/**
 * Thêm nhanh VẬT TƯ MỚI ngay trong form đặt hàng — hàng phát sinh khi mua (NCC
 * chào loại mới) không phải chạy sang Kho khai trước. Chỉ trường thiết yếu; tồn
 * tối thiểu/vị trí kệ… Kho bổ sung sau ở danh mục.
 *
 * Bộ ô nhập lấy từ `MaterialCoreFields` — DÙNG CHUNG với form danh mục Kho, để
 * hai chỗ không hỏi lệch nhau như trước (xem ghi chú đầu file đó).
 *
 * KHÔNG dùng <form>: component này nằm TRONG form tạo PO, form lồng form bị HTML
 * cấm (browser sẽ submit form ngoài → mất sạch dòng đang nhập).
 */
export function QuickAddMaterial({
  onCreated,
  template: soanTheoMau,
}: {
  onCreated: (m: CreatedMaterial) => void
  /**
   * Mẫu đơn ĐANG SOẠN — chỉ dùng làm gợi ý cuối khi máy không đoán được từ tên.
   * KHÔNG gán cứng cho vật tư mới: người dùng hay tiện tay khai luôn món không
   * thuộc mẫu đang soạn, mà mẫu quyết định bộ cột của mọi đơn sau này.
   */
  template: PoTemplate
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // Nhóm BẮT BUỘC ở form khai nhanh (0124): nhóm là phạm vi chặn trùng tên của
  // server — người đang vội soạn đơn hay bỏ trống nhất, và vật tư không nhóm
  // lọt lưới chặn rồi thành mã trùng thứ n.
  const core = useMaterialCore({
    active: open,
    templateHint: soanTheoMau,
    requireGroup: true,
  })

  async function handle() {
    if (core.invalid || busy) return
    setBusy(true)
    try {
      const { material } = await api<{ material: CreatedMaterial }>(
        '/api/dept/warehouse/materials',
        { method: 'POST', body: { ...core.corePayload(), min_stock: 0 } },
      )
      toast.success(`Đã thêm ${material.code}`, 'Vật tư vào ngay dòng đặt bên dưới')
      // Ô chọn vật tư cache kết quả tìm theo tab — không xoá thì vật tư vừa tạo
      // không hiện ra khi gõ lại đúng từ khoá cũ.
      invalidateMaterialPickCache()
      onCreated(material)
      setOpen(false)
    } catch (err) {
      toast.error(
        'Thêm vật tư thất bại',
        err instanceof ApiError ? err.message : 'Có lỗi',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-[13px] font-medium text-zinc-600 shadow-xs transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
        title="NCC chào loại chưa có trong danh mục — khai tại chỗ, vào thẳng dòng"
      >
        <Plus className="size-4" aria-hidden /> Khai vật tư mới
      </button>
      {open && (
        <Modal
          open={open}
          title="Thêm vật tư mới"
          onClose={() => setOpen(false)}
          maxWidth="sm:max-w-2xl"
        >
          <div className="flex flex-col gap-3">
            {/*
              KHÔNG CÓ Ô "MÃ VT" — server tự cấp `XX-0000` nối tiếp theo nhóm.
              Quy ước mã là của danh mục, không phải thứ người soạn đơn phải nhớ;
              gõ `NH999` giữa lúc vội là lệch khỏi cả nghìn mã còn lại.
            */}
            <MaterialCoreFields
              s={core}
              inputClass={cls}
              unitListId="qa-dvt"
              subListId="qa-nhom-phu"
            />
            <p className="text-muted-foreground text-xs">
              Tồn tối thiểu, vị trí kệ, mã vạch… Kho bổ sung sau ở danh mục vật tư.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Huỷ
              </button>
              <button
                type="button"
                disabled={busy || core.invalid}
                onClick={() => void handle()}
                className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {busy && <Spinner size={14} />}
                Thêm &amp; đưa vào đơn
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
