'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: fd.get('email'),
        password: fd.get('password'),
      }),
    })
    setLoading(false)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Đăng nhập thất bại' }))
      setError(error)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel (left, hidden on mobile) */}
      <div className="hidden flex-col justify-between bg-slate-900 p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-md bg-amber-500 text-lg font-bold text-slate-900">
            HG
          </span>
          <div>
            <div className="text-lg font-semibold">Hoàng Gia</div>
            <div className="text-xs uppercase tracking-wider text-slate-400">
              Task Manager
            </div>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-semibold leading-tight">
            Quản lý công việc<br />cho mọi phòng ban.
          </h2>
          <p className="mt-3 max-w-md text-sm text-slate-400">
            Giao việc, báo cáo tiến độ, theo dõi kế hoạch tuần. Tất cả ở một
            chỗ — minh bạch, đúng hạn.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          © {new Date().getFullYear()} Công ty SXTM Hoàng Gia
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
        <form
          onSubmit={onSubmit}
          className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          {/* Mobile brand */}
          <div className="mb-1 flex items-center gap-2 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-amber-500 text-sm font-bold text-slate-900">
              HG
            </span>
            <span className="font-semibold">Hoàng Gia</span>
          </div>

          <h1 className="text-xl font-semibold">Đăng nhập</h1>

          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Mật khẩu
            <input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            disabled={loading}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>

          <p className="text-center text-xs text-zinc-500">
            Tài khoản do quản trị viên cấp. Liên hệ admin nếu bạn chưa có.
          </p>
        </form>
      </div>
    </div>
  )
}
