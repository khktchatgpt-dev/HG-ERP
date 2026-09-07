'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { DateField } from '@/components/erp/DateField'
import { Button } from '@/components/shadcn/button'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { MATERIALS_DUE_LEAD_DAYS, suggestMaterialsDue } from '@/lib/lsx-supply'

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Lưu hạn vật tư của một lệnh — cùng route với ô ở trang chi tiết lệnh. */
export async function saveMaterialsDue(lsxId: string, iso: string | null): Promise<void> {
  await api(`/api/dept/production/lsx/${lsxId}/materials-due`, {
    method: 'PATCH',
    body: { materials_due_at: iso },
  })
}

/**
 * HẠN VẬT TƯ SỬA NGAY TRÊN DÒNG (B5, 05/09/2026). Đo 05/09: 0/15 lệnh có hạn nên
 * mọi cảnh báo im lặng — ô ở trang chi tiết có mà không ai vào điền. Đưa ô ra
 * danh sách, kèm gợi ý "ngày xuất − 30" bấm một cái là xong.
 */
export function LsxDueEditor({
  lsxId,
  value,
  shipDate,
  today,
  compact,
}: {
  lsxId: string
  value: string | null
  shipDate: string | null
  today: string
  /** Dùng trong thẻ nhỏ: ô hẹp hơn. */
  compact?: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const suggestion = value ? null : suggestMaterialsDue(shipDate, today)

  async function save(iso: string) {
    if ((iso || null) === value) return
    setBusy(true)
    try {
      await saveMaterialsDue(lsxId, iso || null)
      toast.success(iso ? `Hạn vật tư: ${dmy(iso)}` : 'Đã xoá hạn vật tư')
      router.refresh()
    } catch (e) {
      toast.error('Không lưu được hạn vật tư', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <DateField
        value={value ?? ''}
        onChange={(iso) => void save(iso)}
        disabled={busy}
        className={compact ? 'h-7 w-32 text-xs' : 'h-8 w-36'}
        aria-label="Hạn vật tư phải về"
      />
      {suggestion && (
        <Button
          variant="link"
          size="sm"
          className="text-muted-foreground h-auto w-fit p-0 text-[11px]"
          disabled={busy}
          onClick={() => void save(suggestion)}
          title={`Ngày xuất trừ ${MATERIALS_DUE_LEAD_DAYS} ngày`}
        >
          <Sparkles className="size-3" />
          Gợi ý {dmy(suggestion)}
        </Button>
      )}
    </div>
  )
}
