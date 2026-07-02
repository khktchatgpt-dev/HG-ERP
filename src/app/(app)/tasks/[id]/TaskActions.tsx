'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useConfirm, usePrompt } from '@/components/ui/ConfirmDialog'

type Props = {
  taskId: string
  status: string
  isAssignee: boolean
  isAssigner: boolean
}

export function TaskActions({ taskId, status, isAssignee, isAssigner }: Props) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const prompt = usePrompt()
  const [busy, setBusy] = useState(false)

  async function call(path: string, body?: unknown) {
    setBusy(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}${path}`, {
        method: 'POST',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Có lỗi xảy ra' }))
        toast.error('Thao tác thất bại', error)
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  type Btn = { label: string; onClick: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'success' }
  const buttons: Btn[] = []

  if (isAssignee && (status === 'todo' || status === 'rejected' || status === 'on_hold')) {
    buttons.push({
      label: status === 'on_hold' ? 'Tiếp tục' : 'Bắt đầu',
      onClick: () => call('/status', { status: 'in_progress' }),
    })
  }
  if (isAssignee && status === 'in_progress') {
    buttons.push({
      label: 'Tạm hoãn',
      onClick: () => call('/status', { status: 'on_hold' }),
    })
  }
  if (isAssignee && ['todo', 'in_progress', 'rejected'].includes(status)) {
    buttons.push({
      label: 'Báo hoàn thành',
      onClick: () => call('/submit'),
      variant: 'primary',
    })
  }
  if (isAssigner && status === 'submitted') {
    buttons.push({ label: 'Duyệt', onClick: () => call('/approve'), variant: 'success' })
    buttons.push({
      label: 'Trả lại',
      variant: 'danger',
      onClick: async () => {
        const reason = await prompt({
          title: 'Trả lại công việc',
          description: 'Vui lòng nhập lý do để người thực hiện cải thiện.',
          inputLabel: 'Lý do',
          placeholder: 'VD: thiếu file đính kèm…',
          required: true,
          confirmLabel: 'Trả lại',
          tone: 'danger',
        })
        if (reason) call('/reject', { reason })
      },
    })
  }
  if (isAssigner && ['todo', 'in_progress', 'rejected', 'submitted', 'on_hold'].includes(status)) {
    buttons.push({
      label: 'Huỷ',
      variant: 'danger',
      onClick: async () => {
        const ok = await confirm({
          title: 'Huỷ công việc?',
          description: 'Công việc sẽ chuyển sang trạng thái "Đã huỷ".',
          tone: 'danger',
          confirmLabel: 'Huỷ công việc',
        })
        if (ok) call('/status', { status: 'cancelled' })
      },
    })
  }

  if (buttons.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {buttons.map((b) => (
        <Button key={b.label} variant={b.variant ?? 'secondary'} loading={busy} onClick={b.onClick}>
          {b.label}
        </Button>
      ))}
    </div>
  )
}
