'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'

type Settings = {
  company_name: string
  company_tax_code: string
  company_address: string
  company_phone: string
}

export function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [s, setS] = useState(initial)
  const [dirty, setDirty] = useState(false)

  function upd<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS((prev) => ({ ...prev, [k]: v }))
    setDirty(true)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api('/api/settings', { method: 'PATCH', body: s })
      setDirty(false)
      toast.success('Đã lưu cấu hình')
      router.refresh()
    } catch (e) {
      toast.error('Lưu thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setS(initial)
    setDirty(false)
  }

  const cls =
    'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950'

  const btnSecondary =
    'rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900'
  const btnPrimary =
    'rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200'

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Quản trị', href: '/admin' },
          { label: 'Cấu hình' },
        ]}
        title="Cấu hình hệ thống"
        description="Thông tin công ty áp dụng cho toàn bộ hệ thống."
        actions={
          <>
            {dirty && (
              <button type="button" onClick={reset} disabled={busy} className={btnSecondary}>
                Huỷ
              </button>
            )}
            <button
              type="submit"
              disabled={busy || !dirty}
              className={`inline-flex items-center gap-2 ${btnPrimary}`}
            >
              {busy && <Spinner size={14} />}
              {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          </>
        }
      />

      <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Thông tin công ty
          </h2>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Tên công ty" required>
            <input
              value={s.company_name}
              onChange={(e) => upd('company_name', e.target.value)}
              required
              className={cls}
            />
          </Field>

          <Field label="Mã số thuế">
            <input
              value={s.company_tax_code}
              onChange={(e) => upd('company_tax_code', e.target.value)}
              placeholder="0123456789"
              className={cls}
            />
          </Field>

          <Field label="Số điện thoại">
            <input
              value={s.company_phone}
              onChange={(e) => upd('company_phone', e.target.value)}
              placeholder="0281234567"
              className={cls}
            />
          </Field>

          <Field label="Địa chỉ" className="sm:col-span-2">
            <input
              value={s.company_address}
              onChange={(e) => upd('company_address', e.target.value)}
              className={cls}
            />
          </Field>
        </div>
      </section>

      {dirty && (
        <div className="sticky bottom-4 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm dark:border-amber-700 dark:bg-amber-950/50">
          <span className="text-amber-800 dark:text-amber-200">
            Có thay đổi chưa lưu.
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={reset} className={btnSecondary}>
              Huỷ
            </button>
            <button
              type="submit"
              disabled={busy}
              className={`inline-flex items-center gap-2 ${btnPrimary}`}
            >
              {busy && <Spinner size={14} />}
              {busy ? 'Đang lưu…' : 'Lưu'}
            </button>
          </div>
        </div>
      )}
    </form>
  )
}

function Field({
  label,
  required,
  children,
  className = '',
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  )
}
