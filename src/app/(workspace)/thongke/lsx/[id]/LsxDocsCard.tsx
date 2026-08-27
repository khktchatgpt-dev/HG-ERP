'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCheck, Trash2 } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/shadcn/button'
import { DocChip } from '@/components/erp/DocChip'
import { TopProgressBar } from '@/components/erp/Spinner'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { STATUS_LABEL, type EntryDocStatus } from '@/lib/entry-doc-flow'

/**
 * PHIẾU CỦA LỆNH (B2 rút gọn — 27/08, không còn tầng tổ trưởng duyệt):
 * xem lại phiếu đã ghi; phiếu NHÁP thì Ghi chính thức hoặc Xoá. Xoá dùng
 * xác nhận hai nhịp (bấm lần 2 trong 3s) thay vì window.confirm.
 */

export type DocRow = {
  id: string
  doc_no: string
  entry_date: string
  stage: string
  status: EntryDocStatus
  team_name: string | null
  created_by_name: string | null
  note: string | null
  total_qty: number
  total_defect: number
  line_count: number
}

const TONE: Record<EntryDocStatus, 'gray' | 'amber' | 'green' | 'red'> = {
  nhap: 'gray',
  cho_xac_nhan: 'amber',
  da_xac_nhan: 'green',
  tu_choi: 'red',
}

const fmt = (n: number) => n.toLocaleString('vi-VN')
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('vi-VN')

export function LsxDocsCard({
  docs,
  stageLabels,
  canRecord,
}: {
  docs: DocRow[]
  stageLabels: Record<string, string>
  canRecord: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  if (docs.length === 0) return null

  async function submit(doc: DocRow) {
    if (busy) return
    setBusy(true)
    try {
      await api(`/api/dept/production/entry-docs/${doc.id}`, { method: 'PATCH' })
      toast.success(`Phiếu ${doc.doc_no} đã ghi chính thức`)
      router.refresh()
    } catch (e) {
      toast.error('Không ghi chính thức được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove(doc: DocRow) {
    if (busy) return
    if (confirmDel !== doc.id) {
      setConfirmDel(doc.id)
      setTimeout(() => setConfirmDel((v) => (v === doc.id ? null : v)), 3000)
      return
    }
    setConfirmDel(null)
    setBusy(true)
    try {
      await api(`/api/dept/production/entry-docs/${doc.id}`, { method: 'DELETE' })
      toast.success(`Đã xoá phiếu ${doc.doc_no}`)
      router.refresh()
    } catch (e) {
      toast.error('Không xoá được phiếu', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bg-card overflow-hidden rounded-lg border">
      <TopProgressBar active={busy} />
      <div className="bg-muted/60 flex items-center gap-2 border-b px-4 py-2">
        <h2 className="text-sm font-semibold">Phiếu báo sản lượng của lệnh</h2>
        <span className="t-data text-muted-foreground ml-auto text-xs">
          {docs.length} phiếu
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-[10px] uppercase">
              <th className="px-4 py-1.5">Số phiếu</th>
              <th className="py-1.5 pr-2">Ngày</th>
              <th className="py-1.5 pr-2">Công đoạn</th>
              <th className="py-1.5 pr-2">Tổ</th>
              <th className="py-1.5 pr-2 text-right">Dòng</th>
              <th className="py-1.5 pr-2 text-right">Σ đạt</th>
              <th className="py-1.5 pr-2 text-right">Phế</th>
              <th className="py-1.5 pr-2">Trạng thái</th>
              <th className="py-1.5 pr-2">Người lập</th>
              {canRecord && <th className="py-1.5 pr-4" />}
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="border-b last:border-b-0">
                <td className="px-4 py-1.5">
                  <DocChip>{d.doc_no}</DocChip>
                </td>
                <td className="t-data py-1.5 pr-2">{fmtDate(d.entry_date)}</td>
                <td className="py-1.5 pr-2">{stageLabels[d.stage] ?? d.stage}</td>
                <td className="py-1.5 pr-2">{d.team_name ?? '—'}</td>
                <td className="t-data py-1.5 pr-2 text-right">{d.line_count}</td>
                <td className="t-data py-1.5 pr-2 text-right font-semibold">
                  {fmt(d.total_qty)}
                </td>
                <td className="t-data py-1.5 pr-2 text-right">
                  {d.total_defect > 0 ? (
                    <span className="text-[var(--warn)]">{fmt(d.total_defect)}</span>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
                <td className="py-1.5 pr-2">
                  <Badge tone={TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                </td>
                <td className="text-muted-foreground py-1.5 pr-2 text-xs">
                  {d.created_by_name ?? '—'}
                </td>
                {canRecord && (
                  <td className="py-1.5 pr-4">
                    <span className="flex items-center justify-end gap-1.5">
                      {(d.status === 'nhap' || d.status === 'tu_choi') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={busy}
                          onClick={() => submit(d)}
                        >
                          <CheckCheck aria-hidden />
                          Ghi chính thức
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-7 px-2 text-xs ${
                          confirmDel === d.id
                            ? 'border-[var(--stop)] text-[var(--stop)]'
                            : ''
                        }`}
                        disabled={busy}
                        onClick={() => remove(d)}
                        aria-label={`Xoá phiếu ${d.doc_no}`}
                      >
                        <Trash2 aria-hidden />
                        {confirmDel === d.id ? 'Xoá thật?' : 'Xoá'}
                      </Button>
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground border-t px-4 py-2 text-[11px]">
        Phiếu nháp chưa tính vào tiến độ — ghi chính thức hoặc xoá. Phiếu đã chính thức
        muốn sửa: xoá rồi ghi lại (tổ đã chốt sổ ngày thì mở khoá trước).
      </p>
    </section>
  )
}
