'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Empty,
  Grid,
  GridBody,
  GridHead,
  GridRow,
  Tag,
  Td,
  Th,
} from '@/components/kit'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { STATUS_LABEL, type EntryDocStatus } from '@/lib/entry-doc-flow'

/**
 * PHIẾU BÁO SẢN LƯỢNG CỦA LỆNH — khối trong trang chứng từ (M3).
 *
 * Bản kit của `LsxDocsCard` cũ. Giữ nguyên nghiệp vụ: phiếu NHÁP thì ghi chính
 * thức hoặc xoá; phiếu nào cũng in được để ký tay. Xoá dùng xác nhận HAI NHỊP
 * (bấm lần hai trong 3 giây) thay vì `window.confirm` — hộp thoại của trình
 * duyệt không mang được ngữ cảnh "đang xoá phiếu nào".
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

const TONE: Record<EntryDocStatus, 'neutral' | 'warn' | 'done' | 'stop'> = {
  nhap: 'neutral',
  cho_xac_nhan: 'warn',
  da_xac_nhan: 'done',
  tu_choi: 'stop',
}

const fmt = (n: number) => n.toLocaleString('vi-VN')
const fmtDate = (iso: string) => iso.split('-').reverse().join('/')

export function PhieuTab({
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

  if (docs.length === 0) {
    return (
      <Empty
        headline="Lệnh này chưa có phiếu báo sản lượng nào"
        reason="Mỗi lượt ghi sổ sinh một phiếu có số hiệu. Chưa có phiếu nghĩa là chưa ai ghi sản lượng cho lệnh."
        next={
          <span className="text-[var(--ink-3)]">Bấm “Ghi sản lượng” ở khối trên.</span>
        }
      />
    )
  }

  return (
    <Grid minWidth={880}>
      <GridHead>
        <Th width={140}>Số phiếu</Th>
        <Th>Ngày</Th>
        <Th>Công đoạn</Th>
        <Th>Tổ</Th>
        <Th num>Dòng</Th>
        <Th num>Σ đạt</Th>
        <Th num>Phế</Th>
        <Th>Trạng thái</Th>
        <Th>Người lập</Th>
        <Th />
      </GridHead>
      <GridBody>
        {docs.map((d) => (
          <GridRow key={d.id}>
            <Td>
              <b className="num">{d.doc_no}</b>
            </Td>
            <Td num>{fmtDate(d.entry_date)}</Td>
            <Td>{stageLabels[d.stage] ?? d.stage}</Td>
            <Td>{d.team_name ?? '—'}</Td>
            <Td num>{fmt(d.line_count)}</Td>
            <Td num>{fmt(d.total_qty)}</Td>
            <Td num tone={d.total_defect > 0 ? 'warn' : undefined}>
              {d.total_defect > 0 ? fmt(d.total_defect) : ''}
            </Td>
            <Td>
              <Tag tone={TONE[d.status]}>{STATUS_LABEL[d.status]}</Tag>
            </Td>
            <Td>{d.created_by_name ?? '—'}</Td>
            <Td>
              <span className="flex justify-end gap-1">
                {/* In được ở MỌI trạng thái: tổ trưởng ký trên giấy, kể cả
                    phiếu còn nháp thống kê vẫn cầm đi đối chiếu. */}
                <Btn href={`/print/phieu-sx/${d.id}`}>In</Btn>
                {canRecord && (d.status === 'nhap' || d.status === 'tu_choi') && (
                  <Btn primary disabled={busy} onClick={() => submit(d)}>
                    Ghi chính thức
                  </Btn>
                )}
                {canRecord && (
                  <Btn
                    danger={confirmDel === d.id}
                    disabled={busy}
                    onClick={() => remove(d)}
                  >
                    {confirmDel === d.id ? 'Xoá thật?' : 'Xoá'}
                  </Btn>
                )}
              </span>
            </Td>
          </GridRow>
        ))}
      </GridBody>
    </Grid>
  )
}
