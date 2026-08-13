'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, LockOpen } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { usePrompt } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/erp/Spinner'

/**
 * KHOÁ / MỞ KHOÁ HỒ SƠ SP — đặt ngay ở HEADER trang chi tiết (user chốt
 * 13/08/2026: "mọi thứ xử lí ở trang chi tiết chính", trước đó nút nằm trong
 * tab Tài liệu nên phải đi tìm).
 *
 * Một nhịp: bấm là khoá, không đòi chọn file BOM trước. Mở khoá thì bắt lý do
 * — gỡ bản cả xưởng đang dùng thì phải nói vì sao (server cũng chặn).
 */
export function ProductLockButton({
  productId,
  locked,
}: {
  productId: string
  locked: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const prompt = usePrompt()
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<unknown>, ok: string, hint?: string) {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      toast.success(ok, hint)
      router.refresh()
    } catch (e) {
      toast.error('Không thực hiện được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  if (!locked) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void run(
            () =>
              api(`/api/dept/technical/products/${productId}/lock`, {
                method: 'POST',
                body: { note: null },
              }),
            'Đã khoá hồ sơ',
            'Mọi phòng dùng bản này; muốn sửa phải mở khoá',
          )
        }
        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? <Spinner size={14} /> : <Lock className="size-4" aria-hidden />}
        Khoá hồ sơ
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        const reason = await prompt({
          title: 'Mở khoá hồ sơ để sửa?',
          description:
            'Hồ sơ đang khoá là bản mọi phòng đang dùng. Mở khoá để sửa thì phải ghi lý do — lưu lại để sau còn truy.',
          inputLabel: 'Lý do mở khoá',
          placeholder: 'VD: khách đổi quy cách chân bàn, phải sửa định mức',
          required: true,
          confirmLabel: 'Mở khoá',
        })
        if (!reason) return
        await run(
          () =>
            api(`/api/dept/technical/products/${productId}/lock`, {
              method: 'DELETE',
              body: { reason },
            }),
          'Đã mở khoá',
          'Nhớ khoá lại sau khi sửa xong',
        )
      }}
      className="bg-card inline-flex items-center gap-1.5 rounded-md border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-800 shadow-xs hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
    >
      {busy ? <Spinner size={14} /> : <LockOpen className="size-4" aria-hidden />}
      Mở khoá để sửa
    </button>
  )
}
