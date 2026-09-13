'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import { Spinner } from '@/components/erp/Spinner'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { uploadFile } from '@/lib/upload'

/**
 * TẢI LÊN / ĐỔI / BỎ ảnh mặt cắt của một khuôn.
 *
 * Đi ĐÚNG luồng tải file sẵn có (`uploadFile` → `/api/files` 3 bước → rồi
 * `POST .../dies/[id]/image` trỏ con trỏ), y như ảnh đại diện sản phẩm. KHÔNG
 * dựng đường tải riêng: luồng kia đã lo sẵn soát đuôi file, soát MIME, trần
 * dung lượng, tự thu nhỏ ảnh máy ảnh, và quyền ghi theo `parent`.
 *
 * 169/215 khuôn có ảnh là do nạp từ file Excel của Kỹ thuật. 46 khuôn còn lại
 * và mọi khuôn khai mới từ nay chỉ có đường này — nên nút phải nằm ngay trong
 * hồ sơ, không nhét vào một màn quản trị riêng.
 */
export function KhuonImageActions({
  dieId,
  dieCode,
  hasImage,
}: {
  dieId: string
  dieCode: string
  hasImage: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      // `doc_type: 'image'` để luồng tải tự thu nhỏ ảnh chụp về ≤2560px và ăn
      // đúng trần dung lượng của ảnh.
      const fileId = await uploadFile(
        file,
        { kind: 'die', id: dieId },
        'attachments',
        'image',
      )
      await api(`/api/dept/technical/dies/${dieId}/image`, {
        method: 'POST',
        body: { file_id: fileId },
      })
      toast.success(`Đã cập nhật mặt cắt khuôn ${dieCode}`)
      router.refresh()
    } catch (e) {
      toast.error(apiErrorText(e, 'Không tải được ảnh'))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function clear() {
    setBusy(true)
    try {
      await api(`/api/dept/technical/dies/${dieId}/image`, { method: 'DELETE' })
      toast.success('Đã bỏ ảnh khỏi hồ sơ')
      router.refresh()
    } catch (e) {
      toast.error(apiErrorText(e, 'Không bỏ được ảnh'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Ô chọn file ĐỨNG ẨN, nút bấm mới là thứ người dùng thấy — trình duyệt
          không cho tạo kiểu cho nút chọn file mặc định, nên mọi nơi đều làm vậy. */}
      <Input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Spinner size={14} /> : <ImagePlus />}
        {hasImage ? 'Đổi ảnh mặt cắt' : 'Tải ảnh mặt cắt'}
      </Button>
      {hasImage && (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void clear()}>
          <Trash2 /> Bỏ ảnh
        </Button>
      )}
    </div>
  )
}
