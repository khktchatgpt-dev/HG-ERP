'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/Badge'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { Spinner } from '@/components/erp/Spinner'
import { CERT_TYPES } from '@/modules/dept/supply/certs.schema'

type Cert = {
  id: string
  cert_type: string
  cert_no: string | null
  issued_on: string | null
  note: string | null
}

/** Chứng chỉ NCC (M3) — ISO/IATF/HACCP… không theo dõi hạn. */
export function CertsPanel({
  supplierId,
  canEdit,
}: {
  supplierId: string
  canEdit: boolean
}) {
  const toast = useToast()
  const [rows, setRows] = useState<Cert[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [certType, setCertType] = useState('')
  const [certNo, setCertNo] = useState('')
  const [issuedOn, setIssuedOn] = useState('')
  const [note, setNote] = useState('')

  async function reload() {
    const d = await api<{ certs: Cert[] }>(
      `/api/dept/supply/certs?supplier_id=${supplierId}`,
    )
    setRows(d.certs)
  }

  useEffect(() => {
    let alive = true
    api<{ certs: Cert[] }>(`/api/dept/supply/certs?supplier_id=${supplierId}`)
      .then((d) => alive && setRows(d.certs))
      .catch((e) => {
        if (alive) {
          setRows([])
          toast.error(
            'Không tải được chứng chỉ',
            e instanceof ApiError ? e.message : 'Có lỗi',
          )
        }
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId])

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    try {
      await api('/api/dept/supply/certs', {
        method: 'POST',
        body: {
          supplier_id: supplierId,
          cert_type: certType,
          cert_no: certNo.trim() || null,
          issued_on: issuedOn || null,
          note: note.trim() || null,
        },
      })
      toast.success('Đã thêm chứng chỉ', certType)
      setCertType('')
      setCertNo('')
      setIssuedOn('')
      setNote('')
      await reload()
    } catch (err) {
      toast.error('Thêm thất bại', err instanceof ApiError ? err.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function remove(c: Cert) {
    if (!window.confirm(`Xoá chứng chỉ ${c.cert_type}?`)) return
    setBusy(true)
    try {
      await api(`/api/dept/supply/certs/${c.id}`, { method: 'DELETE' })
      await reload()
    } catch (err) {
      toast.error('Xoá thất bại', err instanceof ApiError ? err.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const inp =
    'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <form onSubmit={add} className="grid gap-2 sm:grid-cols-6">
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            Loại chứng chỉ <span className="text-red-500">*</span>
            <select
              value={certType}
              onChange={(e) => setCertType(e.target.value)}
              required
              className={inp}
            >
              <option value="">— chọn —</option>
              {CERT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Số chứng chỉ
            <input
              value={certNo}
              onChange={(e) => setCertNo(e.target.value)}
              className={inp}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Ngày cấp
            <input
              type="date"
              value={issuedOn}
              onChange={(e) => setIssuedOn(e.target.value)}
              className={inp}
            />
          </label>
          <div className="flex items-end">
            <button
              disabled={busy || !certType}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {busy && <Spinner size={12} />}+ Thêm
            </button>
          </div>
          <label className="flex flex-col gap-1 text-xs sm:col-span-6">
            Ghi chú
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              className={inp}
            />
          </label>
        </form>
      )}

      {rows === null ? (
        <p className="py-4 text-center text-xs text-zinc-400">Đang tải…</p>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-zinc-400">
          Chưa có chứng chỉ nào{canEdit ? ' — thêm ở trên.' : '.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs tracking-wide text-zinc-500 uppercase dark:border-zinc-800">
                <th className="py-1.5 pr-2">Chứng chỉ</th>
                <th className="py-1.5 pr-2">Số</th>
                <th className="py-1.5 pr-2">Ngày cấp</th>
                <th className="py-1.5 pr-2">Ghi chú</th>
                <th className="w-8 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-1.5 pr-2">
                    <Badge tone="blue">{c.cert_type}</Badge>
                  </td>
                  <td className="py-1.5 pr-2 font-mono text-xs">{c.cert_no ?? '—'}</td>
                  <td className="py-1.5 pr-2 text-xs">
                    {c.issued_on
                      ? new Date(c.issued_on).toLocaleDateString('vi-VN')
                      : '—'}
                  </td>
                  <td className="max-w-40 truncate py-1.5 pr-2 text-xs text-zinc-500">
                    {c.note ?? '—'}
                  </td>
                  <td className="py-1.5 text-right">
                    {canEdit && (
                      <button
                        onClick={() => void remove(c)}
                        className="text-xs text-red-500 hover:underline"
                        title="Xoá chứng chỉ"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
