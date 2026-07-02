'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function CommentForm({
  taskId,
  canReport,
}: {
  taskId: string
  canReport: boolean
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<'comment' | 'progress_report'>('comment')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!body.trim()) return
    setBusy(true)
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body, kind }),
    })
    setBusy(false)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Failed' }))
      alert(error)
      return
    }
    setBody('')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          canReport ? 'Viết bình luận hoặc báo cáo tiến độ…' : 'Viết bình luận…'
        }
        rows={3}
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex items-center justify-between gap-2">
        {canReport ? (
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as 'comment' | 'progress_report')}
            className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="comment">Bình luận</option>
            <option value="progress_report">Báo cáo tiến độ</option>
          </select>
        ) : (
          <span />
        )}
        <button
          onClick={submit}
          disabled={busy || !body.trim()}
          className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Gửi
        </button>
      </div>
    </div>
  )
}
