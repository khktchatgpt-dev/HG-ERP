'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { Button } from '@/components/shadcn/button'
import { Textarea } from '@/components/shadcn/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog'
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
import type { PendingLsx, PendingPo, PendingQuote } from './approval-types'

/**
 * Logic DUYỆT / TỪ CHỐI một phiếu (LSX/PO) + 2 dialog xác nhận — tách ra hook
 * để dùng chung cho buồng lái (ApprovalCockpit) lẫn trang chi tiết đơn duyệt
 * (/exec/approvals/{lsx,po}/[id]). API giữ nguyên.
 */
export type DecideTarget = {
  kind: 'lsx' | 'po' | 'quote'
  id: string
  code: string
  label: string
}

/** Tên loại phiếu trong tiêu đề dialog. */
const KIND_NOUN = { lsx: 'LSX', po: 'đơn đặt', quote: 'báo giá' } as const
/** Duyệt xong thì chuyện gì được mở khoá — câu nhắc trong dialog duyệt. */
const APPROVE_UNLOCKS = {
  lsx: 'Duyệt xong Cung ứng mới đặt được vật tư.',
  po: 'Duyệt xong Cung ứng mới gửi được cho NCC (BR-05).',
  quote: 'Duyệt xong Sale mới chốt & gửi khách được.',
} as const

export function targetLsx(
  l: Pick<PendingLsx, 'id' | 'code' | 'customer_name' | 'order_codes'>,
): DecideTarget {
  return {
    kind: 'lsx',
    id: l.id,
    code: l.code,
    label: `${l.customer_name} · ${l.order_codes.length > 1 ? `${l.order_codes.length} đơn` : `đơn ${l.order_codes[0] ?? '?'}`}`,
  }
}
export function targetQuote(
  q: Pick<PendingQuote, 'id' | 'code' | 'customer_name'>,
): DecideTarget {
  return { kind: 'quote', id: q.id, code: q.code, label: q.customer_name }
}
export function targetPo(
  p: Pick<PendingPo, 'id' | 'code' | 'supplier_name' | 'lsx_code'>,
): DecideTarget {
  return {
    kind: 'po',
    id: p.id,
    code: p.code,
    label: `${p.supplier_name} · ${p.lsx_code ? `LSX ${p.lsx_code}` : 'ngoài LSX'}`,
  }
}

async function callDecide(
  t: DecideTarget,
  decision: 'approve' | 'reject',
  reason?: string,
) {
  if (t.kind === 'lsx') {
    await api(`/api/dept/production/lsx/${t.id}/${decision}`, {
      method: 'POST',
      body: decision === 'reject' ? { reason } : {},
    })
  } else if (t.kind === 'quote') {
    await api(`/api/dept/sales/quotes/${t.id}/decide`, {
      method: 'POST',
      body: { decision, reason },
    })
  } else {
    await api(`/api/dept/supply/pos/${t.id}/decide`, {
      method: 'POST',
      body: { decision, reason },
    })
  }
}

export function useApprovalDecision(onSettled?: () => void) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [approveTarget, setApproveTarget] = useState<DecideTarget | null>(null)
  const [rejectTarget, setRejectTarget] = useState<DecideTarget | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [manyTargets, setManyTargets] = useState<DecideTarget[] | null>(null)

  /**
   * Ký nhiều phiếu một lượt — gọi TUẦN TỰ từng phiếu, không dừng khi một phiếu
   * lỗi. Cố ý: mỗi phiếu là một quyết định độc lập, phiếu thứ 3 hỏng không có lý
   * do gì làm mất chữ ký của phiếu 1 và 2. Cuối cùng báo rõ cái nào hỏng vì sao,
   * phiếu hỏng vẫn nằm lại trong hộp.
   */
  async function confirmApproveMany() {
    const targets = manyTargets
    if (!targets?.length) return
    setBusy(true)
    let ok = 0
    const fails: string[] = []
    for (const t of targets) {
      try {
        await callDecide(t, 'approve')
        ok += 1
      } catch (e) {
        fails.push(`${t.code} (${apiErrorText(e)})`)
      }
    }
    setBusy(false)
    setManyTargets(null)
    if (fails.length === 0) toast.success(`Đã ký ${ok} phiếu`)
    else toast.warning(`Đã ký ${ok} phiếu, ${fails.length} phiếu lỗi`, fails.join(' · '))
    onSettled?.()
  }

  async function confirmApprove() {
    if (!approveTarget) return
    setBusy(true)
    try {
      await callDecide(approveTarget, 'approve')
      toast.success('Đã duyệt', approveTarget.code)
      setApproveTarget(null)
      onSettled?.()
    } catch (e) {
      toast.error('Thao tác thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function submitReject() {
    if (!rejectTarget) return
    const reason = rejectReason.trim()
    if (!reason) return
    setBusy(true)
    try {
      await callDecide(rejectTarget, 'reject', reason)
      toast.success('Đã từ chối', rejectTarget.code)
      setRejectTarget(null)
      setRejectReason('')
      onSettled?.()
    } catch (e) {
      toast.error('Thao tác thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const dialogs = (
    <>
      <AlertDialog
        open={!!approveTarget}
        onOpenChange={(o) => !o && setApproveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Duyệt {approveTarget ? KIND_NOUN[approveTarget.kind] : ''}{' '}
              {approveTarget?.code}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {approveTarget?.label}.{' '}
              {approveTarget ? APPROVE_UNLOCKS[approveTarget.kind] : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Huỷ</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void confirmApprove()}>
              {busy && <Loader2 className="animate-spin" />} Duyệt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!manyTargets} onOpenChange={(o) => !o && setManyTargets(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Ký {manyTargets?.length ?? 0} phiếu một lượt?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {manyTargets?.map((t) => t.code).join(', ')}. Phiếu giá trị lớn không nằm
              trong danh sách này — loại đó phải mở ra ký riêng.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Huỷ</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void confirmApproveMany()}>
              {busy && <Loader2 className="animate-spin" />} Ký {manyTargets?.length ?? 0}{' '}
              phiếu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRejectTarget(null)
            setRejectReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Từ chối {rejectTarget ? KIND_NOUN[rejectTarget.kind] : ''}{' '}
              {rejectTarget?.code}
            </DialogTitle>
            <DialogDescription>
              {rejectTarget?.label}. Ghi lý do để bộ phận liên quan biết cần sửa gì.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            rows={3}
            placeholder="Lý do từ chối…"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setRejectTarget(null)
                setRejectReason('')
              }}
            >
              Huỷ
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !rejectReason.trim()}
              onClick={() => void submitReject()}
            >
              {busy && <Loader2 className="animate-spin" />} Từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )

  return {
    busy,
    askApprove: setApproveTarget,
    askReject: setRejectTarget,
    askApproveMany: setManyTargets,
    dialogs,
  }
}
