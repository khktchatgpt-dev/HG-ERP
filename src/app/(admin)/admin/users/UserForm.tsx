'use client'

import { useState } from 'react'
import { api, ApiError } from '@/lib/api'
import { Spinner } from '@/components/erp/Spinner'

type Dept = { id: string; name: string }
type Role = 'admin' | 'manager' | 'employee'

export type UserFormValues = {
  id?: string
  email?: string
  password?: string
  name?: string
  role: Role
  department_id?: string | null
  title?: string | null
}

export function UserForm({
  mode,
  initial,
  departments,
  onSuccess,
  onError,
}: {
  mode: 'create' | 'edit'
  initial?: UserFormValues
  departments: Dept[]
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    try {
      if (mode === 'create') {
        await api('/api/users', {
          method: 'POST',
          body: {
            email: fd.get('email'),
            password: fd.get('password'),
            name: (fd.get('name') as string) || undefined,
            role: fd.get('role'),
            department_id: (fd.get('department_id') as string) || null,
            title: (fd.get('title') as string) || null,
          },
        })
      } else {
        if (!initial?.id) throw new Error('Missing user id for edit')
        await api(`/api/users/${initial.id}`, {
          method: 'PATCH',
          body: {
            name: (fd.get('name') as string) || null,
            title: (fd.get('title') as string) || null,
            department_id: (fd.get('department_id') as string) || null,
          },
        })
      }
      onSuccess()
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Có lỗi xảy ra')
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Email
        <input
          name="email"
          type="email"
          required={mode === 'create'}
          defaultValue={initial?.email}
          disabled={mode === 'edit'}
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Họ tên
        <input name="name" defaultValue={initial?.name ?? ''} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Chức danh
        <input name="title" defaultValue={initial?.title ?? ''} className={inputCls} />
      </label>
      {mode === 'create' && (
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Mật khẩu (≥ 8 ký tự)
          <input name="password" type="password" required minLength={8} className={inputCls} />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Vai trò
        <select
          name="role"
          defaultValue={initial?.role ?? 'employee'}
          disabled={mode === 'edit'}
          className={inputCls}
        >
          <option value="employee">Nhân viên</option>
          <option value="manager">Quản lý</option>
          <option value="admin">Quản trị</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Phòng ban
        <select
          name="department_id"
          defaultValue={initial?.department_id ?? ''}
          className={inputCls}
        >
          <option value="">— Chưa gán —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang lưu…' : mode === 'create' ? 'Tạo tài khoản' : 'Lưu thay đổi'}
        </button>
      </div>
      {mode === 'edit' && (
        <p className="text-xs text-zinc-500 sm:col-span-2">
          Đổi email hoặc vai trò cần dùng dropdown vai trò ngay trên bảng, hoặc tạo tài khoản mới.
        </p>
      )}
    </form>
  )
}
