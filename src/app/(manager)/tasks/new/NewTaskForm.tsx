'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function NewTaskForm({
  candidates,
}: {
  candidates: { id: string; label: string }[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const body: Record<string, unknown> = {
      title: fd.get('title'),
      description: fd.get('description') || null,
      assignee_id: fd.get('assignee_id'),
      priority: fd.get('priority'),
    }
    const due = String(fd.get('due_date') ?? '').trim()
    if (due) body.due_date = new Date(due).toISOString()
    const planned = String(fd.get('planned_date') ?? '').trim()
    if (planned) body.planned_date = planned
    const category = String(fd.get('category') ?? '').trim()
    if (category) body.category = category
    const estimate = String(fd.get('estimate_hours') ?? '').trim()
    if (estimate) body.estimate_hours = Number(estimate)
    const tags = String(fd.get('tags') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (tags.length) body.tags = tags

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    setLoading(false)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Failed' }))
      setError(error)
      return
    }
    const { task } = await res.json()
    router.push(`/tasks/${task.id}`)
    router.refresh()
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <label className="flex flex-col gap-1 text-sm">
        Tiêu đề
        <input
          name="title"
          required
          maxLength={200}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Mô tả
        <textarea
          name="description"
          rows={4}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Giao cho
          <select
            name="assignee_id"
            required
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">— Chọn nhân viên —</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Ưu tiên
          <select
            name="priority"
            defaultValue="normal"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="low">Thấp</option>
            <option value="normal">Bình thường</option>
            <option value="high">Cao</option>
            <option value="urgent">Khẩn cấp</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Ngày dự kiến làm (tuỳ chọn)
          <input
            name="planned_date"
            type="date"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Hạn chót (tuỳ chọn)
          <input
            name="due_date"
            type="datetime-local"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Danh mục
          <input
            name="category"
            maxLength={50}
            placeholder="vd: Sản xuất"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Ước tính (giờ)
          <input
            name="estimate_hours"
            type="number"
            min="0"
            step="0.5"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Thẻ (cách nhau dấu phẩy)
          <input
            name="tags"
            maxLength={500}
            placeholder="vd: gấp, sales"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        disabled={loading}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {loading ? 'Đang tạo…' : 'Giao việc'}
      </button>
    </form>
  )
}
