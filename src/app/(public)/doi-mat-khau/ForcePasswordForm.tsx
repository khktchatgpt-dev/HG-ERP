'use client'

import { useState } from 'react'
import { Eye, EyeOff, KeyRound, LogOut, ShieldAlert } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import { Spinner } from '@/components/erp/Spinner'

const MIN_LENGTH = 8

/**
 * Màn đổi mật khẩu tạm. Đứng NGOÀI `WorkspaceShell` nên phải tự đeo `theme-v3`
 * ở gốc — không có class đó thì mọi biến token đều rỗng và trang ra trắng trơn.
 */
export function ForcePasswordForm({
  email,
  name,
}: {
  email: string
  name: string | null
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const tooShort = next.length > 0 && next.length < MIN_LENGTH
  const mismatch = confirm.length > 0 && next !== confirm
  const ready = !!current && next.length >= MIN_LENGTH && next === confirm

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    try {
      await api('/api/account/password', {
        method: 'POST',
        // 403 MUST_CHANGE_PASSWORD không xảy ra ở đúng route này, nhưng 401 do
        // phiên chết giữa chừng thì cứ để helper đưa về /login.
        body: { current_password: current, new_password: next },
      })
      /*
       * ĐIỀU HƯỚNG CỨNG: cookie vừa được cấp lại (claim `mc` đã hạ). Dùng
       * router.push thì client router có thể phát lại RSC cache của lượt trước
       * — lượt đó proxy đang chặn, nên người dùng thấy mình bị đá về đây lần
       * nữa dù đã đổi xong. Cùng lý do với LoginForm.
       */
      window.location.assign('/')
    } catch (err) {
      setBusy(false)
      setError(apiErrorText(err, 'Không đổi được mật khẩu. Thử lại.'))
    }
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {})
    window.location.href = '/login'
  }

  return (
    <div className="theme-v3 bg-background text-foreground grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-3">
          <span className="text-primary-foreground grid size-11 place-items-center rounded-md bg-[var(--primary)] text-base font-bold">
            HG
          </span>
          <div>
            <div className="t-title">Hoàng Gia</div>
            <div className="text-muted-foreground text-xs tracking-wider uppercase">
              ERP nội bộ
            </div>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-card flex flex-col gap-4 rounded-xl border p-6 shadow-sm"
        >
          <div className="flex items-start gap-2.5 rounded-md bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3 py-2.5">
            <ShieldAlert
              className="mt-0.5 size-4 shrink-0 text-[var(--warn)]"
              strokeWidth={1.8}
            />
            <div className="text-sm">
              <p className="font-semibold">Bạn phải đổi mật khẩu trước khi tiếp tục</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Mật khẩu hiện tại do quản trị viên đặt hộ nên có người khác biết. Đặt một
                mật khẩu chỉ riêng bạn biết để mở khoá hệ thống.
              </p>
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            Đang đăng nhập:{' '}
            <span className="text-foreground font-medium">{name ?? email}</span>
            {name && <span className="t-data"> · {email}</span>}
          </p>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="t-label">Mật khẩu quản trị viên cấp</span>
            <Input
              type={show ? 'text' : 'password'}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              autoFocus
              required
              disabled={busy}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="t-label">Mật khẩu mới</span>
            <span className="relative">
              <Input
                type={show ? 'text' : 'password'}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                minLength={MIN_LENGTH}
                required
                disabled={busy}
                aria-invalid={tooShort || undefined}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                tabIndex={-1}
                aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 grid w-10 place-items-center"
              >
                {show ? (
                  <EyeOff className="size-4" strokeWidth={1.8} />
                ) : (
                  <Eye className="size-4" strokeWidth={1.8} />
                )}
              </button>
            </span>
            <span
              className={
                tooShort ? 'text-xs text-[var(--stop)]' : 'text-muted-foreground text-xs'
              }
            >
              Tối thiểu {MIN_LENGTH} ký tự, khác mật khẩu đang dùng.
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="t-label">Nhập lại mật khẩu mới</span>
            <Input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={MIN_LENGTH}
              required
              disabled={busy}
              aria-invalid={mismatch || undefined}
            />
            {mismatch && (
              <span className="text-xs text-[var(--stop)]">Hai ô chưa giống nhau.</span>
            )}
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-md bg-[color-mix(in_srgb,var(--stop)_10%,transparent)] px-3 py-2 text-sm text-[var(--stop)]"
            >
              {error}
            </p>
          )}

          <Button type="submit" disabled={!ready || busy} className="w-full">
            {busy ? <Spinner /> : <KeyRound className="size-4" strokeWidth={1.8} />}
            {busy ? 'Đang đổi…' : 'Đổi mật khẩu và vào hệ thống'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void logout()}
            disabled={busy}
            className="text-muted-foreground"
          >
            <LogOut className="size-4" strokeWidth={1.8} />
            Đăng nhập bằng tài khoản khác
          </Button>
        </form>
      </div>
    </div>
  )
}
