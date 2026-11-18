'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'

/**
 * Hai ô tick mẫu showroom (0303, phiếu 101026 PKD): "Có mẫu" · "Đã treo thẻ".
 * Bấm là ghi ngay (không qua nút Sửa/Lưu) — dùng ở bảng danh sách SP và tab
 * Thông số hồ sơ SP. Treo thẻ tự bật "có mẫu"; bỏ "có mẫu" thì bỏ luôn thẻ (luật ở
 * `productsService.setShowroom`). Lỗi bày ngay dưới ô.
 *
 * Hai ô PHẢI ở cùng một component: tách hai bản (mỗi cột một bản) thì tick
 * "Treo thẻ" xong ô "Có mẫu" đứng im tới khi trang tải lại (dính 18/11/2026).
 */
export function ShowroomTicks({
  productId,
  coMau,
  taggedAt,
  canEdit,
  compact,
  bare,
}: {
  productId: string
  coMau: boolean
  taggedAt: string | null
  canEdit: boolean
  /** Nhãn ngắn ("Mẫu" · "Thẻ") cho ô bảng danh sách. */
  compact?: boolean
  /** Chỉ hai ô tick, không chữ — tiêu đề cột đã nói ("Mẫu · Thẻ"). */
  bare?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Hiện ngay giá trị vừa bấm, không chờ router.refresh().
  const [local, setLocal] = useState<{ co: boolean; tag: boolean } | null>(null)
  // Prop đổi (router.refresh() mang số mới) → bỏ giá trị tạm, tin máy chủ.
  const propKey = `${coMau}|${taggedAt ?? ''}`
  const [seen, setSeen] = useState(propKey)
  if (seen !== propKey) {
    setSeen(propKey)
    setLocal(null)
  }
  const co = local?.co ?? coMau
  const tag = local?.tag ?? !!taggedAt

  async function save(body: { co_mau?: boolean; treo_the?: boolean }) {
    if (busy) return
    setLocal({
      co: body.treo_the ? true : (body.co_mau ?? co),
      tag: body.co_mau === false ? false : (body.treo_the ?? tag),
    })
    setBusy(true)
    setErr(null)
    try {
      await api(`/api/dept/technical/products/${productId}/showroom`, {
        method: 'POST',
        body,
      })
      router.refresh()
    } catch (e) {
      setLocal(null)
      setErr(apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const disabled = !canEdit || busy
  const noQuyen = canEdit ? undefined : 'Chỉ Kỹ thuật / Kinh doanh / Giám đốc tick được'
  const tagDate = taggedAt ? new Date(taggedAt).toLocaleDateString('vi-VN') : null

  return (
    <span className="inline-flex flex-col gap-0.5">
      <span
        className={
          bare
            ? 'inline-flex items-center gap-3'
            : compact
              ? 'inline-flex items-center gap-2.5'
              : 'inline-flex items-center gap-4'
        }
      >
        <label
          className="inline-flex cursor-pointer items-center gap-1.5"
          title={noQuyen ?? (bare ? 'Có mẫu ở showroom' : undefined)}
        >
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={co}
            disabled={disabled}
            onChange={(e) => void save({ co_mau: e.currentTarget.checked })}
            aria-label="Có mẫu ở showroom"
          />
          {!bare && <span>{compact ? 'Mẫu' : 'Có mẫu ở showroom'}</span>}
        </label>
        <label
          className="inline-flex cursor-pointer items-center gap-1.5"
          title={
            noQuyen ??
            (tag && tagDate
              ? `Đã treo thẻ ngày ${tagDate}`
              : bare
                ? 'Đã treo thẻ'
                : undefined)
          }
        >
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={tag}
            disabled={disabled}
            onChange={(e) => void save({ treo_the: e.currentTarget.checked })}
            aria-label="Đã treo thẻ"
          />
          <span hidden={bare}>
            {compact ? 'Thẻ' : 'Đã treo thẻ'}
            {!compact && tag && tagDate && (
              <span className="text-muted-foreground"> · {tagDate}</span>
            )}
          </span>
        </label>
      </span>
      {err && <span className="text-xs text-[var(--stop)]">{err}</span>}
    </span>
  )
}
