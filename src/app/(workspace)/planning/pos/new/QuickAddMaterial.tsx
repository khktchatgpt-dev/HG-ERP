'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/shadcn/button'
import { Checkbox } from '@/components/shadcn/checkbox'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/erp/Spinner'
import { invalidateMaterialPickCache } from '@/components/supply/MaterialPicker'
import {
  MaterialCoreFields,
  materialInputClass,
  useMaterialCore,
} from '@/components/warehouse/MaterialCoreFields'
import { quickReviewFields } from '@/lib/material-group-fields'
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
  /** Thông số theo nhóm (0137) — cách mở/pcs (bao bì), bề mặt (kim loại). */
  open_style: string | null
  pcs_per_ctn: number | null
  finish: string | null
}

// Style CHUẨN dùng chung mọi form vật tư (0137).
const cls = materialInputClass

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
  /*
   * XÁC NHẬN 2 NHỊP khi có tên gần giống (0136): cảnh báo mềm cũ nằm ở hint —
   * người đang vội lướt qua và bấm Thêm luôn, mã trùng thứ n ra đời (đợt dedupe
   * từng phải gộp 277 mã). Giờ có cảnh báo là nút Thêm khoá lại cho tới khi
   * tick "đã đối chiếu" — vẫn khai được hàng thật sự mới, chỉ thêm một nhịp
   * dừng đúng chỗ cần dừng.
   */
  // Tick gắn với ĐÚNG cái tên lúc xác nhận — đổi tên là danh sách gần giống
  // đổi, tick cũ tự hết giá trị (không cần effect reset).
  const [confirmedFor, setConfirmedFor] = useState('')
  const daDoiChieu = confirmedFor === core.f.name
  const canSimilar = core.similar.length > 0
  const blocked = core.invalid || (canSimilar && !daDoiChieu)

  async function handle() {
    if (blocked || busy) return
    setBusy(true)
    try {
      const { material } = await api<{ material: CreatedMaterial }>(
        '/api/dept/warehouse/materials',
        {
          method: 'POST',
          // needs_review (0136): khai giữa lúc soạn đơn — đánh dấu cho Kho rà
          // lại (đối chiếu trùng, bổ sung barem/kệ) ở danh mục. Kèm danh sách
          // TRƯỜNG đang bỏ trống (0138) để Kho rà đúng chỗ thay vì cả bản ghi.
          body: {
            ...core.corePayload(),
            min_stock: 0,
            needs_review: true,
            needs_review_fields: quickReviewFields(core.f, {
              groupCfg: core.groupCfg,
              needsBarWeight: core.needsBarWeight,
              needsSheetWeight: core.needsWeight && core.sheetLike,
              derivedKg: core.derived?.kg ?? null,
            }),
          },
        },
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
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-muted-foreground h-[38px] gap-1.5 rounded-lg px-3 text-[13px]"
        title="NCC chào loại chưa có trong danh mục — khai tại chỗ, vào thẳng dòng"
      >
        <Plus aria-hidden /> Khai vật tư mới
      </Button>
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
              Vật tư khai ở đây mang cờ <b>chờ Kho rà</b> — Kho đối chiếu trùng và bổ sung
              tồn tối thiểu, vị trí kệ, mã vạch… sau ở danh mục vật tư.
            </p>
            {/* Có tên gần giống → nút Thêm khoá tới khi xác nhận đã đối chiếu. */}
            {canSimilar && (
              <label className="border-[color-mix(in_srgb,var(--warn)_30%,transparent)] bg-[color-mix(in_srgb,var(--warn)_8%,transparent)] flex items-start gap-2 rounded-md border px-3 py-2 text-xs text-[var(--warn)]">
                <Checkbox
                  checked={daDoiChieu}
                  onCheckedChange={(v) => setConfirmedFor(v === true ? core.f.name : '')}
                  className="mt-0.5"
                />
                <span>
                  Tôi đã đối chiếu các mã gần giống ở trên — đây là <b>hàng khác</b>,
                  không phải cùng một món viết lệch chính tả.
                </span>
              </label>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Huỷ
              </Button>
              <Button
                type="button"
                disabled={busy || blocked}
                title={
                  canSimilar && !daDoiChieu
                    ? 'Có tên gần giống — tick xác nhận đã đối chiếu trước'
                    : undefined
                }
                onClick={() => void handle()}
              >
                {busy && <Spinner size={14} />}
                Thêm &amp; đưa vào đơn
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
