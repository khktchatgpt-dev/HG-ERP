'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Consequence,
  Pick,
  Sheet,
  SheetActions,
  TextArea,
  useToast,
} from '@/components/kit'
import { apiErrorText } from '@/lib/api'
import { Blocked, FormRow, useMutate } from './shared'

type ImportResult = {
  rows: { row: number; errors: string[]; raw: Record<string, string> }[]
  missingCols: string[]
  created: { code: string; name: string }[]
}

/** Nhập danh sách máy từ Excel: chọn file → xem trước (dòng lỗi nói rõ) → nhập. */
export function ImportSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [res, setRes] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState<null | 'read' | 'commit'>(null)
  const [err, setErr] = useState<string | null>(null)

  async function post(commit: boolean, f = file) {
    if (!f) return
    setBusy(commit ? 'commit' : 'read')
    setErr(null)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const r = await fetch(`/api/may-moc/assets/import${commit ? '?commit=1' : ''}`, {
        method: 'POST',
        body: fd,
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? j.message ?? 'Không đọc được file')
      setRes(j as ImportResult)
      if (commit && j.created.length) {
        toast.success(`Đã nhập ${j.created.length} máy, dụng cụ`)
        router.refresh()
        onClose()
      }
    } catch (e) {
      setErr(apiErrorText(e))
    } finally {
      setBusy(null)
    }
  }
  const bad = res
    ? res.missingCols.length > 0 || res.rows.some((r) => r.errors.length)
    : true
  const n = res?.rows.length ?? 0

  return (
    <Sheet
      open
      onClose={onClose}
      width={900}
      title="Nhập danh sách máy từ Excel"
      subtitle="Tải file mẫu, điền mỗi máy một dòng, rồi chọn file. Có dòng lỗi thì chưa nhập dòng nào."
      footer={
        <SheetActions
          onCancel={onClose}
          onConfirm={() => void post(true)}
          busy={busy != null}
          disabled={!res || bad || n === 0}
          confirmLabel={n ? `Nhập ${n} dòng` : 'Nhập'}
        />
      }
    >
      <div className="grid gap-3" onInput={() => setErr(null)}>
        <div className="flex flex-wrap items-center gap-2">
          <Btn icon="excel" href="/api/may-moc/assets/template">
            Tải file mẫu
          </Btn>
          <Btn icon="them" primary onClick={() => input.current?.click()}>
            Chọn file .xlsx
          </Btn>
          {file && <span className="text-k-sm text-[var(--ink-2)]">{file.name}</span>}
          <input
            ref={input}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              setFile(f)
              setRes(null)
              e.target.value = ''
              if (f) void post(false, f)
            }}
          />
        </div>
        {busy && (
          <p className="text-k-sm text-[var(--ink-3)]">
            {busy === 'commit' ? 'Đang tạo máy, cấp mã tem…' : 'Đang đọc file…'}
          </p>
        )}
        {err && <Blocked>{err}</Blocked>}
        {res && res.missingCols.length > 0 && (
          <Blocked>
            file thiếu cột {res.missingCols.join(', ')} — dùng đúng file mẫu.
          </Blocked>
        )}
        {res && res.missingCols.length === 0 && n === 0 && (
          <Blocked>file không có dòng nào (dòng ví dụ của file mẫu được bỏ qua).</Blocked>
        )}
        {res && n > 0 && (
          <>
            <Consequence>
              {bad
                ? `${res.rows.filter((r) => r.errors.length).length} / ${n} dòng có lỗi. Sửa trong file rồi chọn lại — chưa dòng nào được nhập.`
                : `${n} dòng hợp lệ. Bấm "Nhập" để tạo máy, cấp mã tem và lịch bảo trì gợi ý theo nhóm.`}
            </Consequence>
            <div className="max-h-[360px] overflow-auto border border-[var(--line)]">
              <table className="text-k-sm w-full">
                <thead className="text-k-label sticky top-0 bg-[var(--surface-raised)] text-left text-[var(--ink-label)] uppercase">
                  <tr>
                    <th className="px-2 py-1">Dòng</th>
                    <th className="px-2 py-1">Tên</th>
                    <th className="px-2 py-1">Nhóm</th>
                    <th className="px-2 py-1">Tổ</th>
                    <th className="px-2 py-1">Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {res.rows.map((r) => (
                    <tr
                      key={r.row}
                      className="border-t border-[var(--hair)]"
                      style={
                        r.errors.length ? { background: 'var(--stop-wash)' } : undefined
                      }
                    >
                      <td className="px-2 py-1 font-mono">{r.row}</td>
                      <td className="px-2 py-1">{r.raw.name}</td>
                      <td className="px-2 py-1 font-mono">{r.raw.group}</td>
                      <td className="px-2 py-1">{r.raw.dept || '—'}</td>
                      <td className="px-2 py-1">
                        {r.errors.length ? (
                          <span style={{ color: 'var(--stop)' }}>
                            {r.errors.join(' · ')}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--done)' }}>Hợp lệ</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}

/** Báo mất / thanh lý — bắt lý do, không xoá máy (giữ lịch sử). */
export function DisposeSheet({
  asset,
  onClose,
}: {
  asset: { id: string; code: string; name: string }
  onClose: () => void
}) {
  const m = useMutate()
  const [type, setType] = useState<'thanh_ly' | 'mat'>('thanh_ly')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  async function send() {
    if (reason.trim().length < 5) return setErr('ghi lý do (ít nhất 5 ký tự).')
    setErr(null)
    const r = await m.run(
      () =>
        m.api(`/api/may-moc/assets/${asset.id}`, {
          method: 'PUT',
          body: { status: type, reason: reason.trim() },
        }),
      type === 'mat' ? 'Đã ghi báo mất' : 'Đã ghi thanh lý',
    )
    if (r.ok) onClose()
    else setErr(r.error)
  }
  return (
    <Sheet
      open
      onClose={onClose}
      stakes="nang"
      width={520}
      title={`Báo mất / thanh lý ${asset.code}`}
      subtitle={asset.name}
      footer={
        <SheetActions
          stakes="nang"
          onCancel={onClose}
          onConfirm={() => void send()}
          busy={m.busy}
          confirmLabel={type === 'mat' ? 'Ghi báo mất' : 'Ghi thanh lý'}
        />
      }
    >
      <div className="grid gap-3" onInput={() => setErr(null)}>
        <Consequence>
          Máy ra khỏi danh sách đang dùng, lịch bảo trì dừng tính. Lịch sử sửa chữa và chi
          phí vẫn giữ. Không lùi lại được.
        </Consequence>
        <FormRow label="Loại">
          <Pick
            label="Loại"
            value={type}
            onChange={(v) => setType(v as 'thanh_ly' | 'mat')}
            options={[
              { value: 'thanh_ly', label: 'Thanh lý' },
              { value: 'mat', label: 'Báo mất' },
            ]}
          />
        </FormRow>
        <FormRow label="Lý do">
          <TextArea
            aria-label="Lý do"
            value={reason}
            onChange={setReason}
            rows={3}
            placeholder="VD: hết khấu hao, độ chính xác kém — QĐ 12/QĐ-GĐ"
          />
        </FormRow>
        {err && <Blocked>{err}</Blocked>}
      </div>
    </Sheet>
  )
}
