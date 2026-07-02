'use client'

import { useState } from 'react'
import { api, ApiError } from '@/lib/api'
import { Spinner } from '@/components/erp/Spinner'

export function ResetPasswordForm({
  userId,
  userLabel,
  onSuccess,
  onError,
}: {
  userId: string
  userLabel: string
  onSuccess: (newPassword: string) => void
  onError: (msg: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [reason, setReason] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pw !== confirm) return onError('Xác nhận mật khẩu không khớp')
    if (pw.length < 8) return onError('Mật khẩu phải ≥ 8 ký tự')
    setBusy(true)
    try {
      await api(`/api/users/${userId}/reset-password`, {
        method: 'POST',
        body: { new_password: pw, reason: reason || undefined },
      })
      onSuccess(pw)
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Có lỗi xảy ra')
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">
        Đặt lại mật khẩu cho <b>{userLabel}</b>. Hệ thống không gửi email — bạn tự thông báo cho người dùng.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Mật khẩu mới (≥ 8 ký tự)
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          minLength={8}
          required
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Xác nhận mật khẩu
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={8}
          required
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Lý do (tuỳ chọn — ghi vào audit log)
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="VD: Người dùng quên mật khẩu"
          className={inputCls}
        />
      </label>
      <div className="mt-2 flex justify-end">
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang đặt lại…' : 'Đặt lại mật khẩu'}
        </button>
      </div>
    </form>
  )
}
