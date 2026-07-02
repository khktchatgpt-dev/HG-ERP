'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Modal } from '@/components/Modal'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'

type Product = {
  id: string
  code: string
  name: string
  category: string | null
  drawing_url: string | null
  bom_url: string | null
  notes: string | null
  is_active: boolean
}

export function ProductsManager({
  initial, total, page, q, canEdit,
}: {
  initial: Product[]
  total: number
  page: number
  q: string
  canEdit: boolean
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, startTransition] = useTransition()
  const [search, setSearch] = useState(q)
  const [openCreate, setOpenCreate] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(sp.toString())
    if (value) p.set(key, value)
    else p.delete(key)
    p.delete('page')
    router.push(`?${p.toString()}`)
  }

  async function send(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Lỗi' }))
      toast.error('Thao tác thất bại', error)
      return false
    }
    startTransition(() => router.refresh())
    return true
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <form onSubmit={(e) => { e.preventDefault(); setParam('q', search.trim()) }} className="flex flex-1 gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã hoặc tên SP…"
            className="min-w-48 flex-1"
          />
          <Button>Tìm</Button>
        </form>
        {canEdit && (
          <Button variant="primary" onClick={() => setOpenCreate(true)}>
            + Thêm SP
          </Button>
        )}
      </div>

      {initial.length === 0 ? (
        <EmptyState
          icon="◇"
          title="Thư viện sản phẩm trống"
          description={canEdit ? 'Thêm SP đầu tiên để khởi tạo thư viện.' : 'Chưa có SP nào — liên hệ KT để bổ sung.'}
          action={canEdit && <Button variant="primary" onClick={() => setOpenCreate(true)}>+ Thêm SP</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-2.5">Mã / Tên</th>
                <th className="px-4 py-2.5">Danh mục</th>
                <th className="px-4 py-2.5">Tài liệu</th>
                {canEdit && <th className="px-4 py-2.5 text-right">Hành động</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {initial.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-zinc-400">{p.code}</div>
                    <div className="font-medium">{p.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    {p.category ? <Badge>{p.category}</Badge> : <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {p.drawing_url && (
                      <a href={p.drawing_url} target="_blank" rel="noopener" className="mr-3 underline">
                        Bản vẽ
                      </a>
                    )}
                    {p.bom_url && (
                      <a href={p.bom_url} target="_blank" rel="noopener" className="underline">
                        BOM
                      </a>
                    )}
                    {!p.drawing_url && !p.bom_url && <span className="text-zinc-400">—</span>}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" disabled={busy} onClick={() => setEditing(p)}>
                        Sửa
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        className="ml-1"
                        disabled={busy}
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Xoá SP "${p.name}"?`,
                            description: 'Hành động không thể hoàn tác.',
                            tone: 'danger',
                            confirmLabel: 'Xoá',
                          })
                          if (ok) {
                            const ok2 = await send(`/api/dept/technical/products/${p.id}`, 'DELETE')
                            if (ok2) toast.success('Đã xoá', p.name)
                          }
                        }}
                      >
                        Xoá
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>Tổng: {total}</span>
        <div className="flex gap-2">
          {page > 1 && <button onClick={() => setParam('page', String(page - 1))} className="underline">← Trước</button>}
          {page * 20 < total && <button onClick={() => setParam('page', String(page + 1))} className="underline">Sau →</button>}
        </div>
      </div>

      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Thêm sản phẩm">
        <ProductForm
          submitLabel="Thêm"
          onSubmit={async (body) => {
            const ok = await send('/api/dept/technical/products', 'POST', body)
            if (ok) setOpenCreate(false)
          }}
        />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Sửa — ${editing.name}` : ''}>
        {editing && (
          <ProductForm
            initial={editing}
            submitLabel="Lưu"
            onSubmit={async (body) => {
              const ok = await send(`/api/dept/technical/products/${editing.id}`, 'PATCH', body)
              if (ok) setEditing(null)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

function ProductForm({
  initial, submitLabel, onSubmit,
}: {
  initial?: Partial<Product>
  submitLabel: string
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  const cls = 'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body: Record<string, unknown> = {
      code: String(fd.get('code') ?? '').trim(),
      name: String(fd.get('name') ?? '').trim(),
      category: String(fd.get('category') ?? '').trim() || null,
      drawing_url: String(fd.get('drawing_url') ?? '').trim() || null,
      bom_url: String(fd.get('bom_url') ?? '').trim() || null,
      notes: String(fd.get('notes') ?? '').trim() || null,
    }
    setBusy(true)
    await onSubmit(body)
    setBusy(false)
  }

  return (
    <form onSubmit={handle} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        Mã SP
        <input name="code" required maxLength={100} defaultValue={initial?.code ?? ''} className={cls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Danh mục
        <input name="category" maxLength={100} defaultValue={initial?.category ?? ''} className={cls} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Tên SP
        <input name="name" required maxLength={200} defaultValue={initial?.name ?? ''} className={cls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Link bản vẽ
        <input name="drawing_url" type="url" defaultValue={initial?.drawing_url ?? ''} className={cls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Link BOM
        <input name="bom_url" type="url" defaultValue={initial?.bom_url ?? ''} className={cls} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Ghi chú
        <textarea name="notes" rows={3} maxLength={2000} defaultValue={initial?.notes ?? ''} className={cls} />
      </label>
      <div className="mt-2 flex justify-end sm:col-span-2">
        <button
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
        >
          {busy ? 'Đang lưu…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
