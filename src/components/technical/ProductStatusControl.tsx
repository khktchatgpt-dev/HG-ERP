'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { usePrompt } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/erp/Spinner'
import { cn } from '@/lib/utils'
import {
  LIFECYCLES,
  LIFECYCLE_HINT,
  LIFECYCLE_LABEL,
  LIFECYCLE_TONE,
  requiresReason,
  type Lifecycle,
} from '@/lib/product-lifecycle'

/**
 * TRẠNG THÁI HỒ SƠ SP — MỘT badge ở hàng nút, bấm ra menu 5 chặng.
 *
 * Đã đi một vòng thiết kế rồi quay về đây (user chốt 13/08/2026, "gọn nữa: 1
 * badge + menu xổ"): bản giữa là một THANH riêng bày cả lộ trình nằm ngang —
 * đọc thì rõ nhưng chiếm trọn một tầng của đầu trang, trong khi phần lớn thời
 * gian người ta chỉ cần biết "đang ở chặng nào" chứ không cần nhìn cả năm chặng.
 *
 * Nên: trạng thái nằm ngay hàng nút cùng "Khoá hồ sơ" / "Nhân bản"; cả lộ trình
 * chỉ hiện khi bấm vào. Đầu trang bớt hẳn một tầng.
 *
 * Người KHÔNG có quyền vẫn thấy badge (chỉ mất menu) — trạng thái là tin mọi
 * phòng cần đọc, không phải đặc quyền của người sửa.
 */
export function ProductStatusControl({
  productId,
  current,
  changedAt,
  canEdit,
}: {
  productId: string
  current: Lifecycle
  changedAt: string | null
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const prompt = usePrompt()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const title = changedAt
    ? `${LIFECYCLE_HINT[current]} · chuyển lúc ${new Date(changedAt).toLocaleString('vi-VN')}`
    : LIFECYCLE_HINT[current]

  const pill = cn(
    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
    LIFECYCLE_TONE[current],
  )

  async function move(to: Lifecycle) {
    if (busy || to === current) return
    setOpen(false)
    let reason: string | null = null
    if (requiresReason(current, to)) {
      reason = await prompt({
        title: `Lùi về “${LIFECYCLE_LABEL[to]}”?`,
        description: `Hồ sơ đang ở “${LIFECYCLE_LABEL[current]}”. Mọi phòng nhìn trạng thái này để biết có được chạy hàng hay không, nên lùi chặng phải ghi lý do.`,
        inputLabel: 'Lý do',
        placeholder: 'VD: khách bắt sửa lại mẫu chân bàn',
        required: true,
        confirmLabel: 'Chuyển trạng thái',
      })
      if (!reason) return
    }
    setBusy(true)
    try {
      await api(`/api/dept/technical/products/${productId}/lifecycle`, {
        method: 'POST',
        body: { to, reason },
      })
      toast.success(`Đã chuyển sang “${LIFECYCLE_LABEL[to]}”`)
      router.refresh()
    } catch (e) {
      toast.error('Không chuyển được trạng thái', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  // Chỉ xem: badge tĩnh, không có menu.
  if (!canEdit) {
    return (
      <span className={pill} title={title}>
        {LIFECYCLE_LABEL[current]}
      </span>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={title}
        className={cn(pill, 'hover:opacity-90 disabled:opacity-50')}
      >
        {busy && <Spinner size={14} />}
        {LIFECYCLE_LABEL[current]}
        <ChevronDown className="size-4 opacity-70" aria-hidden />
      </button>

      {open && (
        <>
          {/* Nền bắt cú bấm ra ngoài — khỏi listener toàn trang. */}
          <button
            type="button"
            aria-label="Đóng"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="bg-card absolute end-0 z-20 mt-1 w-72 overflow-hidden rounded-lg border shadow-lg"
          >
            <p className="text-muted-foreground border-b px-3 py-2 text-xs">
              Lộ trình trạng thái hồ sơ
            </p>
            {LIFECYCLES.map((s, i) => {
              const active = s === current
              return (
                <button
                  key={s}
                  type="button"
                  role="menuitem"
                  onClick={() => void move(s)}
                  disabled={active}
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-2 text-start text-sm',
                    active ? 'bg-muted/60' : 'hover:bg-muted/40',
                  )}
                >
                  <span className="text-muted-foreground w-4 shrink-0 text-xs tabular-nums">
                    {active ? (
                      <Check className="text-primary size-4" aria-hidden />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className={cn('block', active && 'font-medium')}>
                      {LIFECYCLE_LABEL[s]}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {LIFECYCLE_HINT[s]}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
