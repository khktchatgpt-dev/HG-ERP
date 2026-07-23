'use client'

import { useMemo, useState } from 'react'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/erp/Spinner'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import type { Role } from '@/modules/core/rbac/rbac.repo'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
        {label}
      </span>
      {children}
    </label>
  )
}

function ModalActions({
  busy,
  disabled,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  busy: boolean
  disabled?: boolean
  onCancel: () => void
  onSubmit: () => void
  submitLabel: string
}) {
  return (
    <div className="mt-2 flex justify-end gap-2">
      <button
        onClick={onCancel}
        className="rounded-md px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300"
      >
        Huỷ
      </button>
      <button
        onClick={onSubmit}
        disabled={busy || disabled}
        className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
      >
        {busy && <Spinner />}
        {submitLabel}
      </button>
    </div>
  )
}

const inputCls =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'

export function CreateRoleModal({
  onClose,
  existingKeys,
  onDone,
}: {
  onClose: () => void
  existingKeys: string[]
  onDone: () => void
}) {
  const toast = useToast()
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  const keyErr =
    key && !/^[a-z][a-z0-9_]*$/.test(key)
      ? 'Chỉ chữ thường, số, gạch dưới'
      : existingKeys.includes(key)
        ? 'Key đã tồn tại'
        : ''

  async function submit() {
    if (busy || keyErr || !key || !label) return
    setBusy(true)
    try {
      await api('/api/admin/rbac/roles', {
        method: 'POST',
        body: { key, label, description: description || null },
      })
      toast.success('Đã tạo vai', label)
      onDone()
    } catch (e) {
      toast.error('Tạo vai thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Tạo vai mới">
      <div className="flex flex-col gap-3">
        <Field label="Key (định danh)">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="vd: qc_lead"
            className={`${inputCls} font-mono`}
          />
          {keyErr && <span className="text-xs text-rose-500">{keyErr}</span>}
        </Field>
        <Field label="Tên hiển thị">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="vd: Tổ trưởng QC"
            className={inputCls}
          />
        </Field>
        <Field label="Mô tả (tuỳ chọn)">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
          />
        </Field>
        <ModalActions
          busy={busy}
          disabled={!!keyErr || !key || !label}
          onCancel={onClose}
          onSubmit={submit}
          submitLabel="Tạo vai"
        />
      </div>
    </Modal>
  )
}

export function EditRoleModal({
  role,
  onClose,
  onDone,
}: {
  role: Role
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [label, setLabel] = useState(role.label)
  const [description, setDescription] = useState(role.description ?? '')
  const [isActive, setIsActive] = useState(role.is_active)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (busy || !label) return
    setBusy(true)
    try {
      await api(`/api/admin/rbac/roles/${role.id}`, {
        method: 'PATCH',
        body: { label, description: description || null, is_active: isActive },
      })
      toast.success('Đã lưu vai', label)
      onDone()
    } catch (e) {
      toast.error('Lưu thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Sửa vai · ${role.key}`}>
      <div className="flex flex-col gap-3">
        <Field label="Tên hiển thị">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Mô tả">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            disabled={role.is_system}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4"
          />
          Kích hoạt
          {role.is_system && (
            <span className="text-xs text-zinc-400">(vai hệ thống — không tắt được)</span>
          )}
        </label>
        <ModalActions
          busy={busy}
          disabled={!label}
          onCancel={onClose}
          onSubmit={submit}
          submitLabel="Lưu"
        />
      </div>
    </Modal>
  )
}

export type CurrentRole = { role_id: string; source: 'derived' | 'manual' }

export function AssignRolesModal({
  userId,
  userLabel,
  roles,
  current,
  onClose,
  onDone,
}: {
  userId: string
  userLabel: string
  roles: Role[]
  current: CurrentRole[]
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [manual, setManual] = useState<Set<string>>(
    () => new Set(current.filter((r) => r.source === 'manual').map((r) => r.role_id)),
  )
  const [busy, setBusy] = useState(false)

  const derivedIds = useMemo(
    () => new Set(current.filter((r) => r.source === 'derived').map((r) => r.role_id)),
    [current],
  )
  const assignable = roles.filter((r) => r.is_active && !derivedIds.has(r.id))

  async function submit() {
    if (busy) return
    setBusy(true)
    try {
      await api(`/api/admin/rbac/users/${userId}/roles`, {
        method: 'PUT',
        body: { role_ids: [...manual] },
      })
      toast.success('Đã lưu vai', userLabel)
      onDone()
    } catch (e) {
      toast.error('Lưu thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Gán vai · ${userLabel}`} maxWidth="sm:max-w-md">
      <div className="flex flex-col gap-3">
        {derivedIds.size > 0 && (
          <div className="rounded-md bg-zinc-50 p-2 text-xs text-zinc-500 dark:bg-zinc-900">
            ⛓ Vai tự đồng bộ (theo phòng/chức danh) không sửa ở đây:{' '}
            {roles
              .filter((r) => derivedIds.has(r.id))
              .map((r) => r.label)
              .join(', ')}
          </div>
        )}
        <div className="max-h-72 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          {assignable.map((r) => (
            <label
              key={r.id}
              className="flex cursor-pointer items-center gap-2 border-b border-zinc-100 px-3 py-2 text-sm last:border-0 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900"
            >
              <input
                type="checkbox"
                checked={manual.has(r.id)}
                onChange={(e) => {
                  const next = new Set(manual)
                  if (e.target.checked) next.add(r.id)
                  else next.delete(r.id)
                  setManual(next)
                }}
                className="h-4 w-4"
              />
              <span className="font-medium">{r.label}</span>
              <span className="font-mono text-[11px] text-zinc-400">{r.key}</span>
            </label>
          ))}
          {assignable.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-zinc-400">
              Không còn vai để gán.
            </p>
          )}
        </div>
        <ModalActions
          busy={busy}
          onCancel={onClose}
          onSubmit={submit}
          submitLabel="Lưu vai gán tay"
        />
      </div>
    </Modal>
  )
}
