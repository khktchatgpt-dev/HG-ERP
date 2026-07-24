'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/ui/Toast'
import {
  BOM_FIELD_LABELS,
  buildImportedRows,
  guessField,
  looksLikeHeader,
  parseDelimited,
  type BomField,
  type ImportedRow,
  type MaterialOpt,
} from '@/lib/bom-import'

/**
 * IMPORT FILE BOM vào bảng định hình (0084): nhận .xlsx/.xls/.csv hoặc DÁN
 * thẳng vùng chọn từ Excel → đoán cột theo tiêu đề (sửa được) → xem trước →
 * đổ vào lưới của SP đích. KHÔNG ghi DB — thống kê rà lại rồi bấm Lưu như
 * thường (cùng triết lý "Gợi ý từ BOM").
 */

type OrderLine = { id: string; product_code: string; product_name: string }

const FIELD_OPTIONS = Object.entries(BOM_FIELD_LABELS) as [BomField, string][]
const sel =
  'rounded border border-zinc-300 px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900'

export function ImportBomDialog({
  open,
  onClose,
  orderLines,
  materials,
  onApply,
}: {
  open: boolean
  onClose: () => void
  orderLines: OrderLine[]
  materials: MaterialOpt[]
  /** Đổ dòng đã map vào lưới (append) cho SP đích — chưa lưu DB. */
  onApply: (orderLineId: string, rows: ImportedRow[]) => void
}) {
  const toast = useToast()
  const [lineId, setLineId] = useState(orderLines[0]?.id ?? '')
  const [cells, setCells] = useState<string[][]>([])
  const [mapping, setMapping] = useState<BomField[]>([])
  const [hadHeader, setHadHeader] = useState(false)
  const [fileName, setFileName] = useState('')
  const [pasteText, setPasteText] = useState('')

  function reset() {
    setCells([])
    setMapping([])
    setHadHeader(false)
    setFileName('')
    setPasteText('')
  }

  /** Nạp ma trận ô: tách tiêu đề (nếu có) + đoán mapping. */
  function ingest(matrix: string[][], source: string) {
    const clean = matrix.filter((r) => r.some((c) => c.trim() !== ''))
    if (!clean.length) {
      toast.error('Không đọc được dòng nào', source)
      return
    }
    const header = looksLikeHeader(clean[0]) ? clean[0] : null
    const body = header ? clean.slice(1) : clean
    const colCount = Math.max(...clean.map((r) => r.length))
    const map: BomField[] = Array.from({ length: colCount }, (_, i) =>
      header ? guessField(header[i] ?? '') : 'skip',
    )
    // Không có tiêu đề → đoán bố cục phổ biến: Cụm · Tên · VT · CT/SP.
    if (!header) {
      const common: BomField[] = ['cluster', 'name', 'material', 'qty_per_unit']
      for (let i = 0; i < Math.min(colCount, common.length); i++) map[i] = common[i]
    }
    setCells(body)
    setMapping(map)
    setHadHeader(!!header)
    setFileName(source)
  }

  async function onFile(file: File) {
    try {
      if (/\.(csv|txt)$/i.test(file.name)) {
        ingest(parseDelimited(await file.text()), file.name)
        return
      }
      // .xlsx/.xls — SheetJS chỉ nạp khi cần (dynamic import, không vào bundle chung).
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await file.arrayBuffer())
      const ws = wb.Sheets[wb.SheetNames[0]]
      const matrix = XLSX.utils.sheet_to_json<string[]>(ws, {
        header: 1,
        raw: false,
        defval: '',
      }) as unknown as string[][]
      ingest(
        matrix.map((r) => r.map((c) => String(c ?? '').trim())),
        `${file.name} · sheet "${wb.SheetNames[0]}"`,
      )
    } catch {
      toast.error('Không đọc được file', 'Kiểm tra định dạng .xlsx / .csv')
    }
  }

  const preview = useMemo(
    () => (cells.length ? buildImportedRows(cells, mapping, materials) : null),
    [cells, mapping, materials],
  )

  function apply() {
    if (!preview || !lineId) return
    if (!mapping.includes('name')) {
      toast.error('Chưa chọn cột "Tên chi tiết"', 'Chọn ở hàng mapping phía trên bảng')
      return
    }
    if (preview.rows.length === 0) {
      toast.error('Không có dòng hợp lệ', 'Dòng phải có tên chi tiết')
      return
    }
    onApply(lineId, preview.rows)
    const line = orderLines.find((l) => l.id === lineId)
    toast.success(
      `Đã đổ ${preview.rows.length} dòng vào ${line?.product_code ?? 'SP'}`,
      'Rà lại từng dòng rồi bấm Lưu bảng chi tiết',
    )
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Import file BOM"
      maxWidth="sm:max-w-4xl"
    >
      <div className="flex flex-col gap-3 text-sm">
        {/* Bước 1 — nguồn dữ liệu */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">SP đích:</span>
          <select
            value={lineId}
            onChange={(e) => setLineId(e.target.value)}
            className={sel}
          >
            {orderLines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.product_code} — {l.product_name}
              </option>
            ))}
          </select>
          <label className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
            📄 Chọn file (.xlsx / .csv)
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
                e.target.value = ''
              }}
            />
          </label>
          {fileName && <Badge tone="blue">{fileName}</Badge>}
        </div>

        {/* Hoặc dán từ Excel */}
        {cells.length === 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-zinc-500">
              …hoặc mở file BOM, bôi đen vùng bảng (kèm dòng tiêu đề càng tốt), Copy rồi
              dán vào đây:
            </span>
            <textarea
              value={pasteText}
              onChange={(e) => {
                setPasteText(e.target.value)
                if (e.target.value.trim())
                  ingest(parseDelimited(e.target.value), 'dán từ Excel')
              }}
              rows={5}
              placeholder={
                'Cụm\tChi tiết\tMã VT\tCT/SP\tĐM kg\nCỤM KHUNG\tKHUNG CHÂN\tVT-SAT-H25\t2\t1,5'
              }
              className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        )}

        {/* Bước 2 — mapping + xem trước */}
        {cells.length > 0 && preview && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge tone={hadHeader ? 'green' : 'amber'}>
                {hadHeader
                  ? 'Đã nhận tiêu đề — cột tự đoán'
                  : 'Không thấy tiêu đề — kiểm tra cột'}
              </Badge>
              <Badge tone="gray">{preview.rows.length} dòng hợp lệ</Badge>
              {preview.unmatched_materials > 0 && (
                <Badge tone="amber">
                  {preview.unmatched_materials} dòng vật tư không khớp danh mục (gắn tay
                  sau)
                </Badge>
              )}
              <button
                onClick={reset}
                className="ml-auto text-xs text-zinc-500 underline hover:text-zinc-700"
              >
                Chọn nguồn khác
              </button>
            </div>

            <div className="max-h-[45vh] overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[720px] text-xs">
                <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    {mapping.map((f, i) => (
                      <th key={i} className="px-1.5 py-1.5 text-left">
                        <select
                          value={f}
                          onChange={(e) =>
                            setMapping((m) =>
                              m.map((x, xi) =>
                                xi === i ? (e.target.value as BomField) : x,
                              ),
                            )
                          }
                          className={`${sel} ${f === 'skip' ? 'opacity-50' : 'font-semibold'}`}
                        >
                          {FIELD_OPTIONS.map(([v, label]) => (
                            <option key={v} value={v}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cells.slice(0, 30).map((row, ri) => (
                    <tr
                      key={ri}
                      className="border-t border-zinc-100 dark:border-zinc-900"
                    >
                      {mapping.map((_, ci) => (
                        <td key={ci} className="px-1.5 py-1 whitespace-nowrap">
                          {row[ci] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {cells.length > 30 && (
                <p className="px-2 py-1 text-[10px] text-zinc-400">
                  … +{cells.length - 30} dòng nữa (import đủ, chỉ xem trước 30)
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  reset()
                  onClose()
                }}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
              >
                Huỷ
              </button>
              <button
                onClick={apply}
                className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-500"
              >
                Đổ {preview.rows.length} dòng vào lưới
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
