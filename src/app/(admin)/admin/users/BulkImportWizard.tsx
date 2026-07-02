'use client'

import { useMemo, useState } from 'react'
import { api, ApiError } from '@/lib/api'
import { Spinner } from '@/components/erp/Spinner'

type Dept = { id: string; name: string }
type Role = 'admin' | 'manager' | 'employee'

type ParsedRow = {
  email: string
  password: string
  name?: string
  role: Role
  department_id?: string | null
  title?: string | null
  _error?: string
}

const REQUIRED_HEADERS = ['email', 'password'] as const
const ROLE_MAP: Record<string, Role> = {
  admin: 'admin',
  'quản trị': 'admin',
  manager: 'manager',
  'quản lý': 'manager',
  employee: 'employee',
  'nhân viên': 'employee',
}

function detectSeparator(line: string): string {
  const tab = (line.match(/\t/g) ?? []).length
  const comma = (line.match(/,/g) ?? []).length
  return tab >= comma ? '\t' : ','
}

/** Parse pasted CSV/TSV. Auto-detect tab vs comma. First line = header. */
function parseRows(raw: string, departments: Dept[]): ParsedRow[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return []

  const sep = detectSeparator(lines[0])
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase())
  for (const req of REQUIRED_HEADERS) {
    if (!headers.includes(req)) return []
  }
  const deptByName = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]))
  const idx = (h: string) => headers.indexOf(h)

  return lines.slice(1).map((line) => {
    const cols = line.split(sep).map((c) => c.trim())
    const email = cols[idx('email')] ?? ''
    const password = cols[idx('password')] ?? ''
    const name = idx('name') >= 0 ? cols[idx('name')] : undefined
    const title = idx('title') >= 0 ? cols[idx('title')] : undefined
    const rawRole = (idx('role') >= 0 ? cols[idx('role')] : '').toLowerCase()
    const role: Role = ROLE_MAP[rawRole] ?? 'employee'
    const rawDept = idx('department') >= 0 ? cols[idx('department')].toLowerCase() : ''
    const department_id = rawDept ? deptByName.get(rawDept) ?? null : null

    const errors: string[] = []
    if (!email.includes('@')) errors.push('email không hợp lệ')
    if (password.length < 8) errors.push('mật khẩu < 8 ký tự')
    if (rawDept && !department_id) errors.push(`phòng ban "${rawDept}" không có`)

    return {
      email: email.toLowerCase(),
      password,
      name: name || undefined,
      role,
      department_id,
      title: title || null,
      _error: errors.length ? errors.join(', ') : undefined,
    }
  })
}

export function BulkImportWizard({
  departments,
  onClose,
  onDone,
  onError,
}: {
  departments: Dept[]
  onClose: () => void
  onDone: (created: number, skipped: number) => void
  onError: (msg: string) => void
}) {
  const [raw, setRaw] = useState('')
  const [busy, setBusy] = useState(false)
  const parsed = useMemo(() => parseRows(raw, departments), [raw, departments])
  const valid = parsed.filter((r) => !r._error)
  const invalid = parsed.length - valid.length

  async function submit() {
    if (valid.length === 0) return onError('Không có dòng hợp lệ nào để import')
    setBusy(true)
    try {
      const res = await api<{ created: unknown[]; skipped: unknown[] }>(
        '/api/users/bulk-import',
        {
          method: 'POST',
          body: {
            users: valid.map((r) => ({
              email: r.email,
              password: r.password,
              name: r.name,
              role: r.role,
              department_id: r.department_id,
              title: r.title,
            })),
          },
        },
      )
      onDone(res.created.length, res.skipped.length)
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Import thất bại')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
        <p className="font-medium">Cách dùng</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4">
          <li>Trong Excel: chọn vùng cần import (kể cả dòng tiêu đề), Ctrl+C</li>
          <li>Dán (Ctrl+V) vào ô bên dưới</li>
          <li>
            Cột bắt buộc: <b>email</b>, <b>password</b>. Cột tuỳ chọn: name, title, role,
            department
          </li>
        </ol>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Dán dữ liệu ở đây (từ Excel hoặc CSV)
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={8}
          placeholder={'email\tpassword\tname\trole\tdepartment\nnv1@hg.com\tpass1234\tNV 1\temployee\tKỹ thuật'}
          className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      {parsed.length > 0 && (
        <div className="max-h-64 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-2 py-1.5">Email</th>
                <th className="px-2 py-1.5">Tên</th>
                <th className="px-2 py-1.5">Role</th>
                <th className="px-2 py-1.5">Phòng ban</th>
                <th className="px-2 py-1.5">Lỗi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {parsed.map((r, i) => (
                <tr key={i} className={r._error ? 'bg-red-50 dark:bg-red-900/20' : undefined}>
                  <td className="px-2 py-1">{r.email}</td>
                  <td className="px-2 py-1">{r.name ?? '—'}</td>
                  <td className="px-2 py-1">{r.role}</td>
                  <td className="px-2 py-1">
                    {r.department_id
                      ? departments.find((d) => d.id === r.department_id)?.name
                      : '—'}
                  </td>
                  <td className="px-2 py-1 text-red-600">{r._error ?? '✓'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {parsed.length > 0 && (
        <p className="text-sm">
          <span className="font-medium">{valid.length}</span> hợp lệ
          {invalid > 0 && (
            <>
              , <span className="text-red-600">{invalid}</span> lỗi sẽ bị bỏ qua
            </>
          )}
          . Email đã tồn tại trong DB sẽ bị server skip.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          disabled={busy}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Huỷ
        </button>
        <button
          onClick={submit}
          disabled={busy || valid.length === 0}
          className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang import…' : `Import ${valid.length} tài khoản`}
        </button>
      </div>
    </div>
  )
}
