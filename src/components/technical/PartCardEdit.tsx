'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/erp/Spinner'
import { derivedPreviewFor, zonesFor, type InputKey } from './part-layouts'
import { PartField, autoPcsOf, type PartDraft } from './PartField'
import { fromPart, toBody } from './PartRowInline'
import type { PartView } from './ProductProfileCards'

/**
 * THẺ SỬA MỘT DÒNG ĐỊNH MỨC — chia vùng theo nhóm hạng mục.
 *
 * Lưới ngang trả đúng ô theo họ khối nhưng dồn hết lên một hàng: khối khung 18
 * ô, nhãn nằm tận hàng tiêu đề bảng, kéo ngang một cái là mất nhãn; lại trộn ô
 * bắt buộc của biểu mẫu với ô hệ thêm cho Cung ứng và ô hệ tự tính, ba thứ nghĩa
 * vụ khác nhau mà trông y hệt. Thẻ này bày theo `zonesFor(group)`: mỗi vùng một
 * nhãn, vùng nào biểu mẫu của nhóm đó không có thì không hiện.
 *
 * Lưới KHÔNG bỏ — nút "Gõ nhiều dòng" vẫn mở lưới để nhập liên tục như bảng
 * tính. Thẻ lo sửa MỘT dòng cho chính xác, lưới lo gõ nhanh nhiều dòng.
 */

const inp =
  'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

/** Ô nào rộng bao nhiêu trong thẻ — số thì hẹp, tên/mã thì rộng. */
const widthOf = (key: InputKey): string => {
  if (key === 'part_name' || key === 'material_code') return 'w-64'
  if (key === 'note' || key === 'material_note') return 'w-56'
  if (key === 'cluster_name' || key === 'profile_code' || key === 'wood_species')
    return 'w-40'
  if (key === 'profile_shape' || key === 'unit' || key === 'color') return 'w-32'
  return 'w-24'
}

export function PartCardEdit({
  productId,
  part,
  groupCode,
  clusterName,
  onClose,
}: {
  productId: string
  part: PartView
  groupCode: string
  clusterName: string | null
  onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [draft, setDraft] = useState<PartDraft>(() => fromPart(part, clusterName))
  const [busy, setBusy] = useState(false)

  const set = (k: InputKey, v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const setMany = (patch: Partial<PartDraft>) => setDraft((d) => ({ ...d, ...patch }))

  const body = toBody(draft, part.material_kind)
  const zones = zonesFor(groupCode)
  const spec = derivedPreviewFor(groupCode)
  const autoPcs = autoPcsOf(draft)

  const canSave = !!body.part_name && !!body.qty && body.qty > 0

  async function save() {
    if (!canSave || busy) return
    setBusy(true)
    try {
      const { _derived, ...rest } = body
      await api(`/api/dept/technical/products/${productId}/parts/${part.id}`, {
        method: 'PATCH',
        body: { ...rest, weight_kg: part.weight_kg ?? _derived.weight_kg },
      })
      router.refresh()
      onClose()
    } catch (err) {
      toast.error('Lưu dòng thất bại', apiErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    const ok = await confirm({
      title: 'Xoá dòng định mức?',
      description: `“${part.part_name}” sẽ bị xoá khỏi định mức của sản phẩm.`,
      confirmLabel: 'Xoá dòng',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/technical/products/${productId}/parts/${part.id}`, {
        method: 'DELETE',
      })
      router.refresh()
      onClose()
    } catch (err) {
      toast.error('Xoá dòng thất bại', apiErrorText(err))
      setBusy(false)
    }
  }

  return (
    // Ô chứa thẻ trải hết bề ngang bảng (colSpan), mà bảng khung rộng gấp mấy
    // lần màn hình — không ghim bề rộng thì hàng nút bị `ml-auto` đẩy ra tận
    // mép phải ngoài tầm nhìn. Ghim lại và neo trái, chỗ mắt đang nhìn.
    <div className="bg-muted/30 w-[min(100%,56rem)] rounded-lg border p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">Sửa dòng định mức</div>
          <div className="text-muted-foreground truncate text-xs">
            {part.part_name || '(chưa đặt tên)'}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thẻ sửa"
          className="hover:bg-muted rounded p-1"
        >
          <X className="text-muted-foreground size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {zones.map((zone, zi) => (
          <div key={zone.label ?? `head-${zi}`}>
            {zone.label && (
              <div className="text-muted-foreground mb-1 text-[11px] font-medium tracking-wide uppercase">
                {zone.label}
              </div>
            )}
            <div className="flex flex-wrap items-end gap-2">
              {zone.cells.map((c) => (
                <label key={c.key} className={cn('flex flex-col gap-1', widthOf(c.key))}>
                  <span className="text-muted-foreground text-[11px]">
                    {c.label}
                    {(c.key === 'part_name' || c.key === 'qty') && (
                      <span className="text-destructive"> *</span>
                    )}
                  </span>
                  <PartField
                    cell={c}
                    draft={draft}
                    set={set}
                    setMany={setMany}
                    className={cn(inp, c.kind === 'num' && 'text-right')}
                  />
                </label>
              ))}
              {/* Số hệ TỰ TÍNH đứng cuối đúng vùng sinh ra nó, không đội lốt ô nhập. */}
              {zone.label === 'Để cung ứng mua' && autoPcs != null && (
                <div className="text-muted-foreground pb-1.5 text-xs">
                  suy từ chiều dài: {autoPcs} khúc / cây
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {spec && (
          <span className="text-muted-foreground text-xs">
            {spec.label}:{' '}
            <b className="text-foreground tabular-nums">
              {body._derived[spec.key] != null
                ? body._derived[spec.key]!.toFixed(spec.digits)
                : '—'}
            </b>
          </span>
        )}
        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy}
          className="text-destructive ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs hover:underline disabled:opacity-40"
        >
          <Trash2 className="size-3.5" /> Xoá dòng
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-md border px-3 py-1.5 text-xs"
        >
          Huỷ
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave || busy}
          className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-40"
        >
          {busy && <Spinner size={12} />}
          Lưu dòng
        </button>
      </div>
      {!canSave && (
        <p className="text-muted-foreground mt-2 text-xs">
          Cần Tên chi tiết và Số lượng lớn hơn 0 mới lưu được.
        </p>
      )}
    </div>
  )
}
