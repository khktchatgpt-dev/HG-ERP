'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/shadcn/button'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { formatBytes } from '@/lib/file-limits'

/**
 * Nút dọn file mồ côi — bản kiểm tra "File chưa hoàn tất upload" trước nay chỉ
 * ĐẾM rồi cảnh báo, không có đường đi xoá; admin đọc xong cũng không làm gì
 * được. Chỉ dọn file cũ hơn 24h để không cắt ngang lần upload đang chạy.
 */
export function CleanupOrphansButton({ count }: { count: number }) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)

  if (count === 0) return null

  async function run() {
    const ok = await confirm({
      title: `Dọn ${count} file chưa hoàn tất?`,
      description:
        'Xoá các file đã khởi tạo upload nhưng không tải xong (cũ hơn 24 giờ). Tài liệu đang dùng không bị ảnh hưởng.',
      confirmLabel: 'Dọn',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      const r = await api<{ removed: number; freedBytes: number }>(
        '/api/admin/files/cleanup',
        { method: 'POST' },
      )
      toast.success(
        `Đã dọn ${r.removed} file`,
        r.freedBytes > 0 ? `Giải phóng ${formatBytes(r.freedBytes)}` : undefined,
      )
      router.refresh()
    } catch (e) {
      toast.error('Dọn thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={() => void run()}>
      {busy ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Trash2 className="size-4" aria-hidden />
      )}
      Dọn {count} file dở
    </Button>
  )
}
