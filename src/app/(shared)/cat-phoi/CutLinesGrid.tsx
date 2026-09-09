'use client'

import { ClipboardPaste, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/shadcn/button'
import { Checkbox } from '@/components/shadcn/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip'
import { Toolbar } from '@/components/erp/Toolbar'
import { GridCellInput } from '@/components/erp/GridCell'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { applyPasteAt, pasteMatrix } from '@/lib/cut-plan/paste'
import {
  blankLine,
  lineHasData,
  type CutLine,
  type CutLineColumn,
} from '@/lib/cut-plan/types'
import { cn } from '@/lib/utils'
import { useVnNumber } from './vn-number'

/** Ô số của lưới đọc số lối Việt ("1.390" = 1390) — xem `vn-number.ts`. */
function VnGridCell({
  value,
  onValueChange,
  col,
  ...props
}: Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: number | ''
  onValueChange: (v: number | '') => void
  col: 'length_mm' | 'qty'
}) {
  const bind = useVnNumber({ value, onValueChange, col })
  return <GridCellInput {...props} {...bind} />
}

/**
 * LƯỚI CHI TIẾT CẦN CẮT — bảng tính, không giới hạn dòng.
 *
 * Ba việc phần mềm cũ không làm được, làm ở đây:
 *  · Bao nhiêu dòng cũng được: Enter ở dòng cuối tự thêm dòng; "+10 dòng".
 *  · Bôi đen xoá nhanh: ô chọn từng dòng + chọn tất cả → "Xoá N dòng"; hoặc
 *    "Xoá tất cả" để chuyển sang mã khác.
 *  · Dán từ bảng khác: Ctrl+V ngay tại ô đang đứng, vùng dán chạy sang phải và
 *    xuống dưới như Excel (đứng ở Dài cắt dán hai cột số là vào Dài + SL).
 */
type Props = {
  lines: CutLine[]
  selected: ReadonlySet<number>
  nextKey: () => number
  onLines: (lines: CutLine[]) => void
  onSelected: (s: Set<number>) => void
  onOpenPaste: () => void
  /** Dòng bị bỏ khỏi lần tính gần nhất (key → lý do) — tô nhẹ để người nhập thấy. */
  skipped: ReadonlyMap<number, string>
}

const COLS: { col: CutLineColumn; label: string; width: string; numeric?: boolean }[] = [
  { col: 'part_name', label: 'Tên chi tiết', width: 'w-[34%]' },
  { col: 'length_mm', label: 'Dài cắt (mm)', width: 'w-[16%]', numeric: true },
  { col: 'qty', label: 'SL (cái)', width: 'w-[12%]', numeric: true },
  { col: 'note', label: 'Ghi chú', width: '' },
]

function focusCell(row: number, col: CutLineColumn) {
  document
    .querySelector<HTMLInputElement>(`[data-row="${row}"][data-col="${col}"]`)
    ?.focus()
}

export function CutLinesGrid({
  lines,
  selected,
  nextKey,
  onLines,
  onSelected,
  onOpenPaste,
  skipped,
}: Props) {
  const toast = useToast()
  const confirm = useConfirm()

  function addRows(n: number, then?: () => void) {
    onLines([...lines, ...Array.from({ length: n }, () => blankLine(nextKey()))])
    if (then) setTimeout(then, 0)
  }

  function update<K extends CutLineColumn>(key: number, col: K, value: CutLine[K]) {
    onLines(lines.map((l) => (l.key === key ? { ...l, [col]: value } : l)))
  }

  function removeKeys(keys: ReadonlySet<number>) {
    const rest = lines.filter((l) => !keys.has(l.key))
    onLines(rest.length ? rest : [blankLine(nextKey())])
    // Chỉ bỏ tick những dòng vừa xoá — bấm thùng rác một dòng không được làm
    // mất lựa chọn ở các dòng khác đang tick.
    onSelected(new Set([...selected].filter((k) => !keys.has(k))))
  }

  async function clearAll() {
    const filled = lines.filter(lineHasData).length
    if (filled > 0) {
      const ok = await confirm({
        title: 'Xoá toàn bộ chi tiết đang nhập?',
        description: `${filled} dòng có số liệu sẽ bị xoá để nhập mã khác. Đầu phiếu giữ nguyên.`,
        confirmLabel: 'Xoá tất cả',
        tone: 'danger',
      })
      if (!ok) return
    }
    onLines(Array.from({ length: 5 }, () => blankLine(nextKey())))
    onSelected(new Set())
  }

  function onKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    col: CutLineColumn,
  ) {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (rowIdx === lines.length - 1) {
        if (e.key === 'Enter') addRows(1, () => focusCell(rowIdx + 1, col))
        return
      }
      focusCell(rowIdx + 1, col)
    } else if (e.key === 'ArrowUp' && rowIdx > 0) {
      e.preventDefault()
      focusCell(rowIdx - 1, col)
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLElement>) {
    const text = e.clipboardData.getData('text/plain')
    // Một ô lẻ (không tab, không xuống dòng) thì để trình duyệt dán như thường.
    if (!text || !/[\t\n]/.test(text)) return
    const el = document.activeElement as HTMLElement | null
    const row = Number(el?.dataset.row)
    const col = el?.dataset.col as CutLineColumn | undefined
    if (!col || !Number.isInteger(row)) return
    e.preventDefault()
    const r = applyPasteAt(lines, row, col, pasteMatrix(text), nextKey)
    onLines(r.lines)
    toast.info(
      `Đã dán ${r.cells} ô`,
      r.added > 0 ? `Thêm ${r.added} dòng mới cho vừa vùng dán.` : undefined,
    )
  }

  const allSelected = lines.length > 0 && lines.every((l) => selected.has(l.key))
  const someSelected = selected.size > 0 && !allSelected

  return (
    <div className="flex flex-col">
      <Toolbar
        left={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addRows(1, () => focusCell(lines.length, 'part_name'))}
            >
              <Plus aria-hidden /> Thêm dòng
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addRows(10)}>
              <Plus aria-hidden /> 10 dòng
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onOpenPaste}>
              <ClipboardPaste aria-hidden /> Dán từ Excel
            </Button>
            <span className="text-muted-foreground hidden text-xs sm:inline">
              Ctrl+V ngay trong ô để dán vùng bảng tại chỗ · Enter xuống dòng
            </span>
          </>
        }
        right={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selected.size === 0}
              onClick={() => removeKeys(selected)}
            >
              <Trash2 aria-hidden /> Xoá{' '}
              {selected.size > 0 ? `${selected.size} dòng đã chọn` : 'dòng đã chọn'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void clearAll()}
            >
              <Trash2 aria-hidden /> Xoá tất cả
            </Button>
          </>
        }
      />
      <div className="bg-card max-h-[60vh] overflow-auto rounded-b-lg border">
        <Table className="table-fixed text-[13px]">
          <TableHeader className="bg-card sticky top-0 z-[1]">
            <TableRow>
              <TableHead className="w-9 text-center">
                <Checkbox
                  aria-label="Chọn tất cả dòng"
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={(v) =>
                    onSelected(v ? new Set(lines.map((l) => l.key)) : new Set())
                  }
                />
              </TableHead>
              <TableHead className="w-10 text-right">#</TableHead>
              {COLS.map((c) => (
                <TableHead key={c.col} className={cn(c.width, c.numeric && 'text-right')}>
                  {c.label}
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody onPaste={onPaste}>
            {lines.map((l, i) => {
              const reason = skipped.get(l.key)
              return (
                <TableRow
                  key={l.key}
                  data-state={selected.has(l.key) ? 'selected' : undefined}
                  className={cn(
                    '[&>td]:p-0',
                    reason && 'bg-[color-mix(in_srgb,var(--warn)_10%,transparent)]',
                  )}
                  title={reason}
                >
                  <TableCell className="text-center">
                    <Checkbox
                      aria-label={`Chọn dòng ${i + 1}`}
                      checked={selected.has(l.key)}
                      onCheckedChange={(v) => {
                        const next = new Set(selected)
                        if (v) next.add(l.key)
                        else next.delete(l.key)
                        onSelected(next)
                      }}
                    />
                  </TableCell>
                  <TableCell className="t-data text-muted-foreground pr-2 text-right">
                    {i + 1}
                  </TableCell>
                  {COLS.map((c) =>
                    c.numeric ? (
                      <TableCell key={c.col}>
                        <VnGridCell
                          value={l[c.col] as number | ''}
                          col={c.col as 'length_mm' | 'qty'}
                          onValueChange={(v) =>
                            update(l.key, c.col as 'length_mm' | 'qty', v)
                          }
                          onKeyDown={(e) => onKeyDown(e, i, c.col)}
                          data-row={i}
                          data-col={c.col}
                          aria-label={`${c.label} dòng ${i + 1}`}
                          className="t-data text-right"
                        />
                      </TableCell>
                    ) : (
                      <TableCell key={c.col}>
                        <GridCellInput
                          value={l[c.col] as string}
                          onChange={(e) =>
                            update(l.key, c.col as 'part_name' | 'note', e.target.value)
                          }
                          onKeyDown={(e) => onKeyDown(e, i, c.col)}
                          data-row={i}
                          data-col={c.col}
                          aria-label={`${c.label} dòng ${i + 1}`}
                        />
                      </TableCell>
                    ),
                  )}
                  <TableCell className="text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={`Xoá dòng ${i + 1}`}
                          onClick={() => removeKeys(new Set([l.key]))}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Xoá dòng</TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
