'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { Spinner } from '@/components/erp/Spinner'

/** Chỉ chấp nhận đường dẫn nội bộ — chặn open-redirect qua ?next=. */
function safeNext(next?: string): string | null {
  if (!next) return null
  if (!next.startsWith('/') || next.startsWith('//')) return null
  if (next.startsWith('/login') || next.startsWith('/api/')) return null
  return next
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    try {
      const { redirect } = await api<{ redirect?: string }>('/api/login', {
        method: 'POST',
        // 401 ở đây = sai mật khẩu, phải hiện lỗi chứ không reload về /login.
        noAuthRedirect: true,
        body: { email: fd.get('email'), password: fd.get('password') },
      })
      // Giữ nguyên trạng thái loading trong lúc chuyển trang.
      router.push(safeNext(next) ?? redirect ?? '/')
      router.refresh()
    } catch (err) {
      setLoading(false)
      setError(
        apiErrorText(err, 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'),
      )
    }
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
            <div className="text-xs tracking-wider text-slate-400 uppercase">
              ERP nội bộ
            </div>
          </div>
        </div>
        <div>
          <h2 className="text-3xl leading-tight font-semibold">
            Một hệ thống
            <br />
            cho mọi phòng ban.
          </h2>
          <p className="mt-3 max-w-md text-sm text-slate-400">
            Bán hàng, kế hoạch, sản xuất, kho, kế toán — giao việc, theo dõi tiến độ, phê
            duyệt. Tất cả ở một chỗ, minh bạch, đúng hạn.
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
              autoFocus
              autoComplete="email"
              disabled={loading}
              className="rounded-md border border-zinc-300 px-3 py-2 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Mật khẩu
            <span className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                disabled={loading}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 pr-14 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </span>
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400"
            >
              {error}
            </p>
          )}

          <button
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            {loading && <Spinner />}
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
