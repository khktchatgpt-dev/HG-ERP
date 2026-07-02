'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function MarkAllRead() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await fetch('/api/notifications', { method: 'POST' })
        setBusy(false)
        router.refresh()
      }}
      className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
    >
      Đánh dấu đã đọc
    </button>
  )
}
