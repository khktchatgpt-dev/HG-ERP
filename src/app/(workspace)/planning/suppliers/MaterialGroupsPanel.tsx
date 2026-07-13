'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { Spinner } from '@/components/erp/Spinner'

export type MaterialGroup = { id: string; code: string; label: string }

/** Nhóm hàng NCC cung cấp (M4) — chip + trình chọn nhiều. */
export function MaterialGroupsPanel({
  supplierId,
  allGroups,
  initialGroupIds,
  canEdit,
}: {
  supplierId: string
  allGroups: MaterialGroup[]
  initialGroupIds: string[]
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set(initialGroupIds))

  const byId = new Map(allGroups.map((g) => [g.id, g]))
  const selected = [...sel].map((id) => byId.get(id)).filter(Boolean) as MaterialGroup[]

  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function save() {
    setBusy(true)
    try {
      await api(`/api/dept/supply/suppliers/${supplierId}/groups`, {
        method: 'PUT',
        body: { group_ids: [...sel] },
      })
      toast.success('Đã lưu nhóm hàng')
      setEditing(false)
      router.refresh()
    } catch (e) {
      toast.error('Lưu thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Nhóm hàng cung cấp
        </h3>
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
          >
            Sửa
          </button>
        )}
      </div>

      {!editing ? (
        selected.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((g) => (
              <Badge key={g.id} tone="purple">
                {g.label}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-sm text-zinc-400">Chưa gán nhóm hàng.</span>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {allGroups.map((g) => (
              <label
                key={g.id}
                className="flex items-center gap-2 rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm dark:border-zinc-800"
              >
                <input
                  type="checkbox"
                  checked={sel.has(g.id)}
                  onChange={() => toggle(g.id)}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                />
                {g.label}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setSel(new Set(initialGroupIds))
                setEditing(false)
              }}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Huỷ
            </button>
            <button
              onClick={() => void save()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {busy && <Spinner size={12} />}Lưu
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
