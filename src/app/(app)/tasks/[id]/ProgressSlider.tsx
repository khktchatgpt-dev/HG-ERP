'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function ProgressSlider({
  taskId,
  initial,
  canEdit,
}: {
  taskId: string
  initial: number
  canEdit: boolean
}) {
  const router = useRouter()
  const [value, setValue] = useState(initial)
  const [busy, startTransition] = useTransition()
  const [savedFor, setSavedFor] = useState<number | null>(null)

  async function save(v: number) {
    const res = await fetch(`/api/tasks/${taskId}/progress`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ progress_percent: v }),
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Lỗi' }))
      alert(error)
      return
    }
    setSavedFor(v)
    startTransition(() => router.refresh())
  }

  if (!canEdit) {
    return (
      <div>
        <div className="mb-1 text-xs font-semibold uppercase text-zinc-500">
          % hoàn thành
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${initial}%` }}
          />
        </div>
        <div className="mt-1 text-xs text-zinc-500">{initial}%</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold uppercase text-zinc-500">% hoàn thành</span>
        <span className="tabular-nums">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        onMouseUp={() => save(value)}
        onTouchEnd={() => save(value)}
        disabled={busy}
        className="w-full accent-zinc-900 dark:accent-white"
      />
      {savedFor === value && (
        <p className="mt-1 text-xs text-green-600">Đã lưu {savedFor}%</p>
      )}
    </div>
  )
}
