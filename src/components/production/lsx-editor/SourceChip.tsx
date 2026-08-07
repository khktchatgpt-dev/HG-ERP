'use client'

import Link from 'next/link'
import { Clock3, Database, ExternalLink, PencilLine, Undo2 } from 'lucide-react'
import type { FieldOrigin, ProfileTab } from '@/modules/dept/production/lsx-line-fill'

/**
 * Chú thích NGUỒN dưới mỗi ô nhập: giá trị này máy lấy từ hồ sơ SP, Sales tự
 * gõ, hay đã lệch khỏi hồ sơ. Không nền, chữ 10px — panel đã có nền sẵn, thêm
 * badge có nền nữa là rối.
 *
 * Chữ "khác hồ sơ SP" chứ KHÔNG phải "Sales đã sửa": hồ sơ SP có thể được cập
 * nhật SAU khi dòng đã soạn, lúc đó chẳng ai sửa gì cả.
 *
 * `pending` (ô đang ghi "xác nhận sau") là thông tin TRỰC GIAO với nguồn — hiện
 * thành dấu riêng bên cạnh, không trộn vào nhãn nguồn.
 */
export function SourceChip({
  origin,
  refValue,
  pending = false,
  productId,
  tab = 'thong-so',
  onRestore,
}: {
  origin: FieldOrigin
  /** Giá trị hồ sơ SP đang ghi — cho tooltip + nút khôi phục. */
  refValue?: string | null
  pending?: boolean
  productId?: string | null
  tab?: ProfileTab
  onRestore?: () => void
}) {
  if (!origin && !pending) return null

  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-tight">
      {origin === 'profile' && (
        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
          <Database className="size-2.5" aria-hidden />
          từ hồ sơ SP
        </span>
      )}

      {origin === 'edited' && (
        <>
          <span
            className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400"
            title={refValue ? `Hồ sơ SP đang ghi: “${refValue}”` : undefined}
          >
            <PencilLine className="size-2.5" aria-hidden />
            khác hồ sơ SP
          </span>
          {onRestore && (
            <button
              type="button"
              onClick={onRestore}
              title={refValue ? `Đặt lại thành “${refValue}”` : 'Lấy lại giá trị hồ sơ'}
              className="text-primary inline-flex items-center gap-0.5 hover:underline"
            >
              <Undo2 className="size-2.5" aria-hidden />
              khôi phục
            </button>
          )}
        </>
      )}

      {origin === 'own' && (
        <>
          <span className="text-muted-foreground">hồ sơ trống — tự nhập</span>
          {productId && (
            <Link
              href={`/products/${productId}/${tab}`}
              target="_blank"
              rel="noopener"
              className="text-primary inline-flex items-center gap-0.5 hover:underline"
            >
              mở hồ sơ
              <ExternalLink className="size-2.5" aria-hidden />
            </Link>
          )}
        </>
      )}

      {origin === 'order' && <span className="text-muted-foreground">từ đơn hàng</span>}

      {pending && (
        <span
          className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400"
          title="Ô này đang ghi giá trị tạm — chưa chốt"
        >
          <Clock3 className="size-2.5" aria-hidden />
          chờ chốt
        </span>
      )}
    </span>
  )
}
