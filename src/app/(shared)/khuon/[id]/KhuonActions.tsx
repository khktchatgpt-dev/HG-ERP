'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shadcn/alert-dialog'
import { Button } from '@/components/shadcn/button'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import type { DieRow, DieSpec } from '@/modules/dept/technical/dies.repo'
import { KhuonFormDialog } from '../_components/KhuonFormDialog'

/**
 * Hàng nút SỬA / XOÁ trên hồ sơ khuôn.
 *
 * Tách khỏi `KhuonDetailScreen` vì màn đó còn dựng bằng bộ kit còn form và hộp
 * xác nhận dùng theme v3 — nhốt phần v3 vào một tệp riêng thì mỗi tệp vẫn chỉ
 * một hệ, và khi hồ sơ chuyển hẳn sang v3 thì tệp này nhập thẳng vào, không phải
 * gỡ rối.
 *
 * XOÁ KHÔNG CHẶN Ở ĐÂY. Service mới biết còn dòng đơn mua / dòng định mức nào
 * trỏ vào mã này; chặn ở client là chặn bằng một con số client không có. Nút cứ
 * cho bấm, hộp xác nhận nói rõ hậu quả, và câu từ chối của server là câu nói
 * VÌ SAO không xoá được ("còn 12 dòng định mức đang ghi mã TD-B108").
 */
export function KhuonActions({
  die,
  holderOptions,
  groupOptions,
}: {
  die: DieRow & DieSpec
  holderOptions: string[]
  groupOptions: string[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  async function remove() {
    setBusy(true)
    try {
      await api(`/api/dept/technical/dies/${die.id}`, { method: 'DELETE' })
      toast.success(`Đã xoá khuôn ${die.code}`)
      router.push('/khuon')
      router.refresh()
    } catch (e) {
      toast.error(apiErrorText(e, 'Không xoá được'))
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        <Pencil /> Sửa hồ sơ
      </Button>
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
        <Trash2 /> Xoá
      </Button>

      {editing && (
        <KhuonFormDialog
          open
          onOpenChange={setEditing}
          die={die}
          holderOptions={holderOptions}
          groupOptions={groupOptions}
        />
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá khuôn {die.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Xoá hẳn khỏi danh mục, kèm toàn bộ nhật ký đời khuôn. Ảnh mặt cắt vẫn nằm
              trên kho file. Không hoàn lại được.
              <br />
              <br />
              Khuôn đã từng dùng thì nên đổi tình trạng sang <b>“Đã bỏ”</b> thay vì xoá —
              giữ được lịch sử, và các dòng đơn cũ ghi mã này vẫn tra ra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void remove()
              }}
              disabled={busy}
            >
              Xoá hẳn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
