'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import type { MyProfile } from '@/modules/core/account/account.service'

type Readonly = {
  role_label: string
  department_name: string | null
  title: string | null
  employee_code: string | null
  last_login_text: string | null
  password_changed_text: string | null
}

const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp'

export function AccountManager({
  profile,
  readonly,
}: {
  profile: MyProfile
  readonly: Readonly
}) {
  const router = useRouter()
  const toast = useToast()
  const { user } = profile

  const [name, setName] = useState(user.name ?? '')
  const [phone, setPhone] = useState(user.phone ?? '')
  const [savingProfile, setSavingProfile] = useState(false)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const profileDirty = name !== (user.name ?? '') || phone !== (user.phone ?? '')
  const busy = savingProfile || savingPassword || savingAvatar

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    try {
      await api('/api/account', { method: 'PATCH', body: { name, phone } })
      toast.success('Đã lưu thông tin')
      router.refresh()
    } catch (err) {
      toast.error('Không lưu được', apiErrorText(err))
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    // Kiểm ở client để người dùng biết ngay, khỏi tốn một vòng gọi API — server
    // vẫn kiểm lại độ dài và "khác mật khẩu cũ" bằng zod.
    if (next !== confirm) {
      toast.error('Xác nhận không khớp', 'Hai ô mật khẩu mới phải giống nhau')
      return
    }
    setSavingPassword(true)
    try {
      await api('/api/account/password', {
        method: 'POST',
        body: { current_password: current, new_password: next },
      })
      setCurrent('')
      setNext('')
      setConfirm('')
      toast.success(
        'Đã đổi mật khẩu',
        'Các thiết bị khác đang đăng nhập đã bị đăng xuất.',
      )
      router.refresh()
    } catch (err) {
      toast.error('Không đổi được mật khẩu', apiErrorText(err))
    } finally {
      setSavingPassword(false)
    }
  }

  async function uploadAvatar(file: File) {
    setSavingAvatar(true)
    try {
      const body = new FormData()
      body.append('file', file)
      // Không dùng `api()`: helper đó luôn đặt content-type JSON, còn multipart
      // cần trình duyệt tự sinh boundary.
      const res = await fetch('/api/account/avatar', { method: 'POST', body })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error ?? 'Tải ảnh thất bại')
      }
      const json = (await res.json()) as { avatar_url: string | null }
      setAvatarUrl(json.avatar_url)
      toast.success('Đã cập nhật ảnh đại diện')
      router.refresh()
    } catch (err) {
      toast.error('Không tải được ảnh', err instanceof Error ? err.message : undefined)
    } finally {
      setSavingAvatar(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removeAvatar() {
    setSavingAvatar(true)
    try {
      await api('/api/account/avatar', { method: 'DELETE' })
      setAvatarUrl(null)
      toast.success('Đã xoá ảnh đại diện')
      router.refresh()
    } catch (err) {
      toast.error('Không xoá được ảnh', apiErrorText(err))
    } finally {
      setSavingAvatar(false)
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <TopProgressBar active={busy} />

      <Card title="Ảnh đại diện" description="JPG, PNG hoặc WEBP — tối đa 2MB">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} email={user.email} size="xl" src={avatarUrl} />
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={AVATAR_ACCEPT}
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void uploadAvatar(f)
              }}
            />
            <Button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={savingAvatar}
            >
              {savingAvatar && <Spinner />}
              {avatarUrl ? 'Đổi ảnh' : 'Tải ảnh lên'}
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="danger"
                onClick={() => void removeAvatar()}
                disabled={savingAvatar}
              >
                Xoá ảnh
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card title="Thông tin cá nhân">
        <form onSubmit={saveProfile} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Họ tên" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
              />
            </Field>
            <Field label="Số điện thoại" hint="Để trống nếu không muốn hiển thị">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={30}
                inputMode="tel"
                placeholder="0905 123 456"
              />
            </Field>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              disabled={!profileDirty || savingProfile}
            >
              {savingProfile && <Spinner />}
              Lưu thay đổi
            </Button>
          </div>
        </form>

        <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-zinc-200 pt-4 text-sm sm:grid-cols-2 dark:border-zinc-800">
          <Row label="Email đăng nhập" value={user.email} />
          <Row label="Vai trò" value={readonly.role_label} />
          <Row label="Phòng ban" value={readonly.department_name} />
          <Row label="Chức danh" value={readonly.title} />
          <Row label="Mã nhân viên" value={readonly.employee_code} />
          <Row label="Đăng nhập lần cuối" value={readonly.last_login_text} />
        </dl>
        <p className="mt-3 text-xs text-zinc-500">
          Những mục trên do quản trị viên quản lý — cần sửa thì liên hệ admin.
        </p>
      </Card>

      <Card
        title="Đổi mật khẩu"
        description={
          readonly.password_changed_text
            ? `Đổi lần cuối: ${readonly.password_changed_text}`
            : 'Bạn chưa từng đổi mật khẩu kể từ khi được cấp tài khoản'
        }
      >
        <form onSubmit={savePassword} className="flex flex-col gap-4">
          <Field label="Mật khẩu hiện tại" required>
            <Input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mật khẩu mới" hint="Tối thiểu 8 ký tự" required>
              <Input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
            <Field label="Nhập lại mật khẩu mới" required>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
          </div>
          <p className="text-xs text-zinc-500">
            Đổi xong, mọi thiết bị khác đang đăng nhập bằng tài khoản này sẽ bị đăng xuất.
            Thiết bị bạn đang dùng vẫn giữ nguyên phiên.
          </p>
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              disabled={!current || !next || savingPassword}
            >
              {savingPassword && <Spinner />}
              Đổi mật khẩu
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className={value ? '' : 'text-zinc-400'}>{value || '—'}</dd>
    </div>
  )
}
