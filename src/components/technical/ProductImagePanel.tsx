'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Modal } from '@/components/Modal'
import { cn } from '@/lib/utils'
import { api, apiErrorText } from '@/lib/api'
import { isSvgUrl } from '@/lib/image'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/erp/Spinner'
import { uploadFile } from '@/lib/upload'
import { formatBytes, maxBytesFor } from '@/lib/file-limits'
import { isProductImage, type ProductFile } from './product-files'

/**
 * Ô ảnh SP + trình xem ảnh.
 *
 * Ảnh SP tách hẳn khỏi "Hồ sơ tài liệu": tải lên / đổi / xoá đều làm ở đây, còn
 * hồ sơ chỉ giữ bản vẽ, BOM, lắp ráp, chứng chỉ.
 *
 * MỘT SP = MỘT ẢNH. Tải ảnh mới là THAY ảnh cũ (ảnh cũ bị xoá hẳn), không có
 * thư viện nhiều ảnh để chọn.
 */
export function ProductImagePanel({
  productId,
  productName,
  imageFileId,
  imageUrl,
  canEdit,
  className,
}: {
  productId: string
  productName: string
  imageFileId: string | null
  /** URL ảnh đại diện, ký sẵn từ server (RSC) — dùng cho ô ảnh ngoài. */
  imageUrl: string | null
  canEdit: boolean
  /** Khổ ô ảnh — nơi gọi quyết định (trang hồ sơ để ảnh to hơn). */
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={imageUrl ? 'Xem ảnh sản phẩm' : 'Thêm ảnh sản phẩm'}
        className={cn(
          'group relative flex h-48 w-full items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 transition hover:border-sky-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-sky-500',
          className,
        )}
      >
        {imageUrl ? (
          <>
            <Image
              src={imageUrl}
              alt={productName}
              width={480}
              height={480}
              unoptimized={isSvgUrl(imageUrl)}
              className="max-h-full max-w-full object-contain"
            />
            <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-[11px] text-white opacity-0 transition group-hover:opacity-100">
              Bấm để xem
            </span>
          </>
        ) : (
          <span className="px-2 text-center text-xs text-amber-600 dark:text-amber-500">
            Chưa có ảnh đại diện
            {canEdit && (
              <span className="mt-0.5 block text-zinc-400">Bấm để thêm ảnh</span>
            )}
          </span>
        )}
      </button>

      {open && (
        <ImageViewer
          productId={productId}
          productName={productName}
          imageFileId={imageFileId}
          canEdit={canEdit}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function ImageViewer({
  productId,
  productName,
  imageFileId,
  canEdit,
  onClose,
}: {
  productId: string
  productName: string
  imageFileId: string | null
  canEdit: boolean
  onClose: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const router = useRouter()
  /**
   * Vẫn lấy cả DANH SÁCH ảnh chứ không chỉ ảnh đại diện: SP cũ có thể còn nhiều
   * ảnh từ trước khi chốt quy tắc 1 ảnh, và thay ảnh phải dọn sạch chúng.
   */
  const [images, setImages] = useState<ProductFile[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Ảnh hiện tại = ảnh đại diện, hoặc ảnh đầu tiên nếu SP cũ chưa đặt đại diện.
  const active = images.find((i) => i.id === imageFileId) ?? images[0] ?? null

  /**
   * SP đã trỏ `image_file_id` vào file nào thì PHẢI xem được file đó, kể cả khi
   * nó không nằm trong `images`.
   *
   * Hai đường lấy ảnh không cùng điều kiện: ô ảnh ngoài do RSC ký URL theo id
   * (`filesRepo.getByIds` — chỉ đòi chưa bị xoá), còn danh sách trong đây gọi
   * `/api/files?product_id=` (`listByParent` — đòi thêm `finalized_at`). File
   * import thiếu cờ finalize vì thế hiện ở ngoài nhưng vào đây báo "Chưa có
   * ảnh". Bám theo id để hai bên nói cùng một chuyện; `/api/files/[id]` cũng
   * chỉ đòi file chưa bị xoá.
   */
  const activeId = active?.id ?? imageFileId
  const url = activeId ? (urls[activeId] ?? null) : null

  /** Ảnh cần dọn khi thay/xoá — gồm cả ảnh đại diện không có trong danh sách. */
  const removableIds = [
    ...new Set([...images.map((i) => i.id), ...(activeId ? [activeId] : [])]),
  ]

  /**
   * KHÔNG đưa `toast` vào deps: ToastProvider dựng lại object context mỗi lần
   * render (Toast.tsx — `const api: Ctx = {...}` không memo), nên `toast` đổi
   * identity liên tục → reload đổi theo → effect chạy lại vô tận. Lỗi tải hiện
   * bằng state ngay trong modal, vừa tránh dep vừa rõ hơn toast.
   */
  const reload = useCallback(async () => {
    try {
      const data = await api<{ files: ProductFile[] }>(
        `/api/files?product_id=${productId}`,
      )
      setImages(data.files.filter(isProductImage))
      setLoadError(null)
    } catch (e) {
      setLoadError(apiErrorText(e))
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  useEffect(() => {
    if (!activeId) return
    const id = activeId
    let cancelled = false
    void (async () => {
      try {
        const r = await api<{ url: string }>(`/api/files/${id}`)
        if (!cancelled) setUrls((m) => ({ ...m, [id]: r.url }))
      } catch {
        /* ảnh lỗi → giữ spinner, không chặn thao tác khác */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeId])

  /**
   * Tải ảnh mới = THAY ảnh cũ. Thứ tự có chủ đích: tải lên → trỏ đại diện sang
   * ảnh mới → mới xoá ảnh cũ. Nếu xoá trước mà upload hỏng thì SP mất ảnh; còn
   * theo thứ tự này, bước cuối hỏng thì cùng lắm sót file thừa, ảnh vẫn đúng.
   */
  async function onUpload(file: File) {
    const max = maxBytesFor('image')
    if (file.size > max) {
      toast.error('Ảnh quá lớn', `${formatBytes(file.size)} — tối đa ${formatBytes(max)}`)
      return
    }
    const previous = removableIds
    setBusy(true)
    try {
      const newId = await uploadFile(
        file,
        { kind: 'product', id: productId },
        'attachments',
        'image',
      )
      await api(`/api/dept/technical/products/${productId}`, {
        method: 'PATCH',
        body: { image_file_id: newId },
      })

      const failed = await removeAll(previous.filter((id) => id !== newId))
      toast.success(
        previous.length ? 'Đã thay ảnh sản phẩm' : 'Đã thêm ảnh sản phẩm',
        failed ? `${file.name} — nhưng ${failed} ảnh cũ chưa xoá được` : file.name,
      )
      await reload()
      router.refresh()
    } catch (e) {
      toast.error('Tải ảnh thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  /** Xoá lần lượt, trả về số ảnh xoá hỏng. Ảnh cũ sót lại không đáng làm hỏng cả thao tác. */
  async function removeAll(ids: string[]): Promise<number> {
    let failed = 0
    for (const id of ids) {
      try {
        await api(`/api/files/${id}`, { method: 'DELETE' })
      } catch {
        failed++
      }
    }
    return failed
  }

  async function onRemove() {
    const ok = await confirm({
      title: 'Xoá ảnh sản phẩm?',
      description:
        'Sản phẩm sẽ không còn ảnh đại diện. Ảnh bị xoá hẳn, không khôi phục được.',
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    setBusy(true)
    try {
      const failed = await removeAll(removableIds)
      if (failed) throw new Error(`${failed} ảnh chưa xoá được`)
      toast.success('Đã xoá ảnh sản phẩm')
      await reload()
      router.refresh()
    } catch (e) {
      toast.error('Xoá thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Ảnh sản phẩm — ${productName}`}
      maxWidth="sm:max-w-3xl"
    >
      <div className="flex flex-col gap-3">
        <div className="flex min-h-[18rem] items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
          {loading ? (
            <Spinner size={20} />
          ) : loadError ? (
            <p className="px-4 py-10 text-center text-sm text-red-600 dark:text-red-400">
              Không tải được ảnh — {loadError}
            </p>
          ) : !activeId ? (
            <p className="px-4 py-10 text-center text-sm text-zinc-400">
              Chưa có ảnh.{canEdit && ' Bấm “+ Tải ảnh lên” để thêm.'}
            </p>
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element -- xem chi tiết: giữ khổ gốc, không resize
            <img
              src={url}
              alt={active?.filename ?? productName}
              className="max-h-[60vh] max-w-full object-contain"
            />
          ) : (
            <Spinner size={20} />
          )}
        </div>

        {/* Chỉ có metadata khi ảnh nằm trong danh sách; ảnh import cũ thì thiếu. */}
        {active && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="min-w-0 flex-1 truncate" title={active.filename}>
              {active.filename}
            </span>
            <span className="shrink-0">
              {formatBytes(active.size_bytes)} ·{' '}
              {new Date(active.created_at).toLocaleDateString('vi-VN')}
            </span>
          </div>
        )}

        {removableIds.length > 1 && (
          <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            SP này còn {removableIds.length - 1} ảnh cũ từ trước. Tải ảnh mới lên sẽ dọn
            hết.
          </p>
        )}

        {canEdit && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            {busy && <Spinner size={14} />}
            {activeId && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onRemove()}
                className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950"
              >
                Xoá ảnh
              </button>
            )}
            <label className="cursor-pointer rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-700 has-disabled:opacity-50">
              {activeId ? 'Đổi ảnh khác' : '+ Tải ảnh lên'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0]
                  e.currentTarget.value = ''
                  if (f) void onUpload(f)
                }}
              />
            </label>
          </div>
        )}
        {canEdit && activeId && (
          <p className="text-right text-[11px] text-zinc-400">
            Đổi ảnh sẽ xoá hẳn ảnh hiện tại.
          </p>
        )}
      </div>
    </Modal>
  )
}
