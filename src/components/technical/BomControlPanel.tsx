'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, LockOpen, ShieldCheck } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { usePrompt } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/erp/Spinner'

/**
 * KIỂM SOÁT BẢN BOM ĐANG DÙNG (0140 — user chốt 13/08/2026).
 *
 * Bài toán: Kỹ thuật cập nhật BOM liên tục, một SP sắp có nhiều file qua các
 * lần sửa — người mua / xưởng mở hồ sơ ra không biết bản nào đúng. Ba nấc, cố
 * ý KHÔNG có bước duyệt của người thứ hai (user chốt: Kỹ thuật tự làm):
 *
 *   1. "BOM đã qua kiểm tra" — Kỹ thuật tự xác nhận đã rà. Vẫn sửa tiếp được.
 *   2. Chọn FILE BOM ĐANG DÙNG — ở panel tài liệu, file đó được làm nổi bật.
 *   3. KHOÁ hồ sơ — chốt hẳn: mọi sửa đổi (thuộc tính + định mức + file) bị
 *      server chặn. Mở lại được khi phát sinh, bắt nhập lý do và ghi vết.
 *
 * Khối này cố ý TO và NỔI: nó là câu trả lời cho "dùng file nào" mà mọi phòng
 * mở hồ sơ đều phải thấy trước tiên.
 */
export function BomControlPanel({
  productId,
  locked,
  lockedAtLabel,
  lockedByName,
  lockNote,
  bomCheckedAtLabel,
  bomFileName,
  bomFileCount,
  unlockedAtLabel,
  unlockReason,
  canLock,
  canEditBom,
}: {
  productId: string
  locked: boolean
  lockedAtLabel: string | null
  lockedByName: string | null
  lockNote: string | null
  bomCheckedAtLabel: string | null
  /** Tên file BOM đang dùng — null = chưa chọn. */
  bomFileName: string | null
  /** Tổng số file BOM của hồ sơ — >1 là lúc cái khoá thật sự có ích. */
  bomFileCount: number
  unlockedAtLabel: string | null
  unlockReason: string | null
  canLock: boolean
  canEditBom: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const prompt = usePrompt()
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<unknown>, okMsg: string, okHint?: string) {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      toast.success(okMsg, okHint)
      router.refresh()
    } catch (e) {
      toast.error('Không thực hiện được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const lock = () =>
    run(
      () =>
        api(`/api/dept/technical/products/${productId}/lock`, {
          method: 'POST',
          body: { note: null },
        }),
      'Đã khoá hồ sơ',
      'Mọi phòng dùng bản này; muốn sửa phải mở khoá',
    )

  async function unlock() {
    // BẮT lý do — gỡ bản cả xưởng đang dùng thì phải nói vì sao (server cũng chặn).
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
  }

  const toggleChecked = (checked: boolean) =>
    run(
      () =>
        api(`/api/dept/technical/products/${productId}/bom-control`, {
          method: 'PATCH',
          body: { checked },
        }),
      checked ? 'Đã đánh dấu BOM qua kiểm tra' : 'Đã bỏ dấu kiểm tra',
    )

  return (
    <section
      className={
        'rounded-xl border p-3.5 ' +
        (locked
          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
          : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20')
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {locked ? (
          <Lock className="size-4 text-emerald-700 dark:text-emerald-400" aria-hidden />
        ) : (
          <LockOpen className="size-4 text-amber-700 dark:text-amber-500" aria-hidden />
        )}
        <b
          className={
            'text-sm ' +
            (locked
              ? 'text-emerald-800 dark:text-emerald-300'
              : 'text-amber-800 dark:text-amber-400')
          }
        >
          {locked ? 'HỒ SƠ ĐÃ KHOÁ — dùng bản này' : 'Hồ sơ đang mở, có thể còn sửa'}
        </b>
        {locked && lockedAtLabel && (
          <span className="text-muted-foreground text-xs">
            khoá {lockedAtLabel}
            {lockedByName ? ` · ${lockedByName}` : ''}
          </span>
        )}
        {!locked && bomCheckedAtLabel && (
          <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-zinc-900 dark:text-emerald-400">
            <ShieldCheck className="size-3" aria-hidden /> BOM đã kiểm tra{' '}
            {bomCheckedAtLabel}
          </span>
        )}

        <div className="ml-auto flex flex-wrap gap-2">
          {canEditBom && !locked && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleChecked(!bomCheckedAtLabel)}
              className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs shadow-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950"
            >
              {bomCheckedAtLabel ? 'Bỏ dấu kiểm tra' : 'Đánh dấu BOM đã kiểm tra'}
            </button>
          )}
          {canLock &&
            (locked ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void unlock()}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-xs font-medium text-emerald-800 shadow-xs hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-zinc-950 dark:text-emerald-300"
              >
                {busy && <Spinner size={12} />}
                <LockOpen className="size-3.5" aria-hidden /> Mở khoá để sửa
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void lock()}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy && <Spinner size={12} />}
                <Lock className="size-3.5" aria-hidden /> Khoá hồ sơ
              </button>
            ))}
        </div>
      </div>

      {/* Câu trả lời cho "dùng file nào" — dòng quan trọng nhất của khối. */}
      <p className="mt-2 text-[13px]">
        {bomFileName ? (
          <>
            File BOM đang dùng: <b>{bomFileName}</b>
            {bomFileCount > 1 && (
              <span className="text-muted-foreground">
                {' '}
                — {bomFileCount - 1} file BOM khác là bản cũ
              </span>
            )}
          </>
        ) : bomFileCount > 0 ? (
          <span className="text-amber-800 dark:text-amber-400">
            ⚠ Hồ sơ có {bomFileCount} file BOM nhưng <b>chưa chọn bản đang dùng</b> — mở
            tab Tài liệu, bấm &quot;Dùng bản này&quot; trên đúng file (bắt buộc trước khi
            khoá).
          </span>
        ) : (
          <span className="text-muted-foreground">Hồ sơ chưa đính file BOM nào.</span>
        )}
      </p>

      {locked && lockNote && (
        <p className="text-muted-foreground mt-1 text-xs">Ghi chú khoá: {lockNote}</p>
      )}
      {!locked && unlockedAtLabel && (
        <p className="text-muted-foreground mt-1 text-xs">
          Mở khoá lần gần nhất {unlockedAtLabel}
          {unlockReason ? ` — ${unlockReason}` : ''}
        </p>
      )}
    </section>
  )
}
