'use client'

import { useState } from 'react'
import { ArrowLeft, ClipboardPaste } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/shadcn/button'
import { Textarea } from '@/components/shadcn/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { ToolbarSelect } from '@/components/erp/Toolbar'
import { useToast } from '@/components/ui/Toast'
import { parseCutPaste, type CutPasteResult } from '@/lib/cut-plan/paste'
import { fmtMm } from '@/lib/cut-plan/format'
import type { CutLine } from '@/lib/cut-plan/types'

export type PasteMode = 'append' | 'replace'

/**
 * DÁN CẢ BẢNG từ Excel — nhận cột theo tiêu đề (hoặc đoán theo nội dung), bày
 * lại cho người dán soát rồi mới vào lưới. Không nuốt dòng nào im lặng: dòng bị
 * bỏ được liệt kê kèm lý do.
 */
export function CutPasteDialog({
  open,
  hasData,
  onClose,
  onConfirm,
}: {
  open: boolean
  /** Lưới đang có số liệu → mặc định THÊM VÀO CUỐI; trống → thay luôn. */
  hasData: boolean
  onClose: () => void
  onConfirm: (rows: Omit<CutLine, 'key'>[], mode: PasteMode) => void
}) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<CutPasteResult | null>(null)
  const [mode, setMode] = useState<PasteMode>(hasData ? 'append' : 'replace')

  function reset() {
    setText('')
    setParsed(null)
  }
  function close() {
    reset()
    onClose()
  }

  function analyze() {
    const r = parseCutPaste(text)
    if (r.rows.length === 0) {
      toast.error(
        'Không đọc được dòng nào',
        r.skipped.length
          ? `${r.skipped.length} dòng bị bỏ: ${r.skipped[0].reason.toLowerCase()}…`
          : 'Cần ít nhất một cột chiều dài (mm). Tên chi tiết, SL, ghi chú thêm nếu có.',
      )
      return
    }
    setParsed(r)
    setMode(hasData ? 'append' : 'replace')
  }

  if (!open) return null
  return (
    <Modal
      open={open}
      onClose={close}
      title="Dán từ Excel — nhập nhiều chi tiết một lượt"
      maxWidth="sm:max-w-3xl"
    >
      {parsed == null ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-xs">
            Copy vùng bảng trong Excel (cột <b>dài cắt</b> là bắt buộc; thêm{' '}
            <b>tên chi tiết · SL · ghi chú</b> nếu có — nhận cả bảng có hay không có tiêu
            đề) rồi dán vào đây. Máy hiện lại cột đã nhận ra để soát trước khi vào lưới.
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            autoFocus
            placeholder={'Tên chi tiết\tDài\tSL\nChân sau\t1390\t40\nChân trước\t390\t40'}
            className="bg-card rounded-lg p-3 font-mono text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              Huỷ
            </Button>
            <Button type="button" disabled={text.trim() === ''} onClick={analyze}>
              Đọc bảng
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs">
            <b className="text-[var(--done)]">{parsed.rows.length} dòng đọc được</b>
            {' · '}
            cột nhận ra{' '}
            {parsed.source === 'header'
              ? 'theo tiêu đề'
              : 'theo nội dung (không có tiêu đề)'}
            : <b>{parsed.mapped.map((m) => m.label).join(' · ')}</b>
            {parsed.skipped.length > 0 && (
              <span className="text-[var(--warn)]">
                {' '}
                · {parsed.skipped.length} dòng bị bỏ
              </span>
            )}
          </p>
          <div className="max-h-[45vh] overflow-auto rounded-lg border">
            <Table className="text-xs">
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead>Tên chi tiết</TableHead>
                  <TableHead className="text-right">Dài (mm)</TableHead>
                  <TableHead className="text-right">SL</TableHead>
                  <TableHead>Quy cách</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-normal">
                      {r.part_name || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="t-data text-right">
                      {r.length_mm === '' ? '' : fmtMm(r.length_mm)}
                    </TableCell>
                    <TableCell className="t-data text-right">
                      {r.qty === '' ? '' : r.qty}
                    </TableCell>
                    <TableCell className="whitespace-normal">{r.spec}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-normal">
                      {r.note}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {parsed.skipped.length > 0 && (
            <ul className="text-muted-foreground max-h-24 overflow-auto text-xs">
              {parsed.skipped.map((s) => (
                <li key={s.line}>
                  Dòng {s.line}: {s.reason} — <span className="font-mono">{s.text}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setParsed(null)}
              className="mr-auto gap-1.5"
            >
              <ArrowLeft aria-hidden /> Dán lại
            </Button>
            <ToolbarSelect
              value={mode}
              onChange={(v) => setMode(v)}
              aria-label="Cách đưa vào lưới"
              options={[
                { value: 'append', label: 'Thêm vào cuối lưới' },
                { value: 'replace', label: 'Thay toàn bộ lưới' },
              ]}
            />
            <Button type="button" variant="outline" onClick={close}>
              Huỷ
            </Button>
            <Button
              type="button"
              onClick={() => {
                onConfirm(parsed.rows, mode)
                close()
              }}
            >
              <ClipboardPaste aria-hidden />
              {mode === 'replace'
                ? `Thay bằng ${parsed.rows.length} dòng`
                : `Thêm ${parsed.rows.length} dòng`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
