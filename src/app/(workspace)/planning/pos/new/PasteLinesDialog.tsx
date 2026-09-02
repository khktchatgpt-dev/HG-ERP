'use client'

import { useState } from 'react'
import { ArrowLeft, ClipboardPaste } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/erp/Spinner'
import { Button } from '@/components/shadcn/button'
import { Textarea } from '@/components/shadcn/textarea'
import { ToolbarSelect } from '@/components/erp/Toolbar'
import { parsePoPaste, type PastedPoLine } from '@/lib/po-paste'
import type { PoMaterial } from '@/components/supply/MaterialPicker'

/** Kết quả khớp của server — xem poMaterialsRepo.matchMany. */
type MatchResult = {
  match: PoMaterial | null
  candidates: PoMaterial[]
  confidence: 'code' | 'sure' | 'fuzzy' | null
}

type Row = {
  pasted: PastedPoLine
  result: MatchResult
  /** 'skip' · 'free' (dòng tự gõ) · index vào candidates. */
  choice: 'skip' | 'free' | number
}

export type PasteConfirm = {
  matched: {
    material: PoMaterial
    qty: number | null
    price: number | null
    note: string | null
  }[]
  /** Dòng không khớp → dòng tự gõ (chỉ mẫu gỗ/gia công). */
  free: { name: string; qty: number | null; price: number | null; note: string | null }[]
}

const num = (n: number) => n.toLocaleString('vi-VN')

/**
 * DÁN TỪ EXCEL (0136) — BOM chưa hoàn thiện nên nhân viên vẫn tính SL trong sổ
 * rồi gõ lại từng dòng; đây là đường tắt lớn nhất: dán vùng bảng (tên/mã · SL ·
 * giá) → máy khớp mã → xem lại → vào đơn một lượt.
 *
 * Ba bậc khớp hiện MÀU khác nhau: code/sure (xanh — tự chọn), fuzzy (vàng —
 * máy ĐỀ CỬ, người soạn phải liếc xác nhận vì sai hàng là sai tiền), không khớp
 * (xám — bỏ qua / chọn tay / thành dòng tự gõ nếu mẫu cho phép). Không nuốt
 * dòng nào im lặng: đếm rõ từng loại.
 */
export function PasteLinesDialog({
  open,
  allowFree,
  onClose,
  onConfirm,
}: {
  open: boolean
  template: string
  /** Mẫu gỗ/gia công: dòng không khớp được chuyển thành dòng tự gõ. */
  allowFree: boolean
  onClose: () => void
  onConfirm: (picked: PasteConfirm) => void
}) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [skipped, setSkipped] = useState(0)

  function reset() {
    setText('')
    setRows(null)
    setSkipped(0)
  }

  async function analyze() {
    const parsed = parsePoPaste(text)
    if (parsed.lines.length === 0) {
      toast.error(
        'Không đọc được dòng nào',
        'Dán vùng bảng từ Excel (có cột tên hàng; SL/giá nếu có) rồi thử lại',
      )
      return
    }
    setBusy(true)
    try {
      const { results } = await api<{ results: MatchResult[] }>(
        '/api/dept/supply/po-materials/match',
        {
          method: 'POST',
          body: {
            items: parsed.lines.map((l) => ({ name: l.name, code: l.code })),
          },
        },
      )
      setSkipped(parsed.skipped)
      setRows(
        parsed.lines.map((pasted, i) => {
          const result = results[i]
          // code/sure/fuzzy đều trỏ vào match (nằm trong candidates hoặc là
          // chính nó) — quy về index để một ô select cầm cả lựa chọn.
          const idx = result.match
            ? Math.max(
                0,
                result.candidates.findIndex((c) => c.id === result.match!.id),
              )
            : -1
          const candidates =
            result.match && idx === -1 && result.candidates.length === 0
              ? [result.match] // khớp theo mã: candidates rỗng — tự nhét vào
              : result.candidates
          return {
            pasted,
            result: { ...result, candidates },
            choice: result.match ? (idx === -1 ? 0 : idx) : 'skip',
          } satisfies Row
        }),
      )
    } catch (e) {
      toast.error('Khớp mã thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  function confirm() {
    if (!rows) return
    const picked: PasteConfirm = { matched: [], free: [] }
    for (const r of rows) {
      if (r.choice === 'skip') continue
      if (r.choice === 'free') {
        picked.free.push({
          name: r.pasted.name,
          qty: r.pasted.qty,
          price: r.pasted.price,
          note: r.pasted.note,
        })
        continue
      }
      const material = r.result.candidates[r.choice]
      if (material) {
        picked.matched.push({
          material,
          qty: r.pasted.qty,
          price: r.pasted.price,
          note: r.pasted.note,
        })
      }
    }
    onConfirm(picked)
    reset()
    onClose()
  }

  if (!open) return null
  const counts = rows
    ? {
        sure: rows.filter(
          (r) =>
            typeof r.choice === 'number' &&
            (r.result.confidence === 'code' || r.result.confidence === 'sure'),
        ).length,
        fuzzy: rows.filter(
          (r) => typeof r.choice === 'number' && r.result.confidence === 'fuzzy',
        ).length,
        manual: rows.filter(
          (r) => typeof r.choice === 'number' && r.result.confidence == null,
        ).length,
        free: rows.filter((r) => r.choice === 'free').length,
        skip: rows.filter((r) => r.choice === 'skip').length,
      }
    : null
  const addable = counts ? counts.sure + counts.fuzzy + counts.manual + counts.free : 0

  return (
    <Modal
      open={open}
      title="Dán từ Excel — thêm dòng hàng loạt"
      onClose={() => {
        reset()
        onClose()
      }}
      maxWidth="sm:max-w-4xl"
    >
      {rows == null ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-xs">
            Copy vùng bảng trong sổ Excel (cột <b>tên hàng</b>; thêm{' '}
            <b>mã VT · SL · đơn giá · ghi chú</b> nếu có — nhận cả bảng có hay không có
            tiêu đề) rồi dán vào đây. Máy khớp với danh mục, dòng nào mơ hồ sẽ hỏi lại —
            không tự đoán.
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            autoFocus
            placeholder={'Vít 4x15 đuôi cá\t13.596\t250\nLong đền nhựa 6x16\t500\t120'}
            className="bg-card rounded-lg p-3 font-mono text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset()
                onClose()
              }}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              disabled={busy || text.trim() === ''}
              onClick={() => void analyze()}
            >
              {busy && <Spinner size={14} />}
              Đọc &amp; khớp mã
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Đếm rõ từng loại — không nuốt dòng nào im lặng. */}
          <p className="text-xs">
            <b className="text-[var(--done)]">{counts!.sure} khớp chắc</b>
            {' · '}
            <b className="text-[var(--warn)]">{counts!.fuzzy} máy đề cử — xem lại</b>
            {' · '}
            <b>{counts!.manual} chọn tay</b>
            {' · '}
            {counts!.free} dòng tự gõ · {counts!.skip} bỏ qua
            {skipped > 0 && (
              <span className="text-muted-foreground">
                {' '}
                · {skipped} dòng nguồn bị bỏ (trống tên / dòng tổng / quá 100)
              </span>
            )}
          </p>
          <div className="border-border max-h-[50vh] overflow-y-auto rounded-lg border">
            {/* eslint-disable-next-line hg/no-raw-control -- bảng SOÁT LẠI trước khi
                thêm: mỗi dòng có một ô chọn cách khớp, tô nền theo độ tin cậy.
                DataTable là bảng danh sách (sắp xếp/phân trang) — không hợp. */}
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-muted-foreground text-left">
                  <th className="px-2 py-1.5 font-semibold">Dòng trong sổ</th>
                  <th className="w-[80px] px-2 py-1.5 text-right font-semibold">SL</th>
                  <th className="w-[90px] px-2 py-1.5 text-right font-semibold">Giá</th>
                  <th className="w-[46%] px-2 py-1.5 font-semibold">Khớp với danh mục</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const tone =
                    r.choice === 'skip'
                      ? 'opacity-60'
                      : r.result.confidence === 'fuzzy' && typeof r.choice === 'number'
                        ? 'bg-[color-mix(in_srgb,var(--warn)_10%,transparent)]'
                        : ''
                  return (
                    <tr
                      key={i}
                      className={`border-border/60 border-t ${tone}`}
                    >
                      <td className="px-2 py-1.5">
                        <div className="font-medium">{r.pasted.name}</div>
                        {r.pasted.code && (
                          <div className="text-muted-foreground font-mono text-[10px]">
                            {r.pasted.code}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {r.pasted.qty != null ? num(r.pasted.qty) : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {r.pasted.price != null ? num(r.pasted.price) : '—'}
                      </td>
                      <td className="px-2 py-1.5">
                        <ToolbarSelect
                          value={String(r.choice)}
                          onChange={(v) =>
                            setRows((rs) =>
                              rs!.map((x, xi) =>
                                xi === i
                                  ? {
                                      ...x,
                                      choice:
                                        v === 'skip' || v === 'free'
                                          ? (v as 'skip' | 'free')
                                          : Number(v),
                                    }
                                  : x,
                              ),
                            )
                          }
                          className="h-auto w-full rounded px-1.5 py-1 text-xs"
                          aria-label={`Khớp cho ${r.pasted.name}`}
                          options={[
                            { value: 'skip', label: '— bỏ qua dòng này —' },
                            ...(allowFree
                              ? [{ value: 'free', label: '＋ thêm thành dòng tự gõ' }]
                              : []),
                            ...r.result.candidates.map((c, ci) => ({
                              value: String(ci),
                              label: `${c.code} — ${c.name}`,
                            })),
                          ]}
                        />
                        {r.result.confidence === 'fuzzy' &&
                          typeof r.choice === 'number' && (
                            <div className="mt-0.5 text-[10px] text-[var(--warn)]">
                              tên gần giống, máy đề cử — xác nhận đúng hàng trước khi thêm
                            </div>
                          )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRows(null)}
              className="mr-auto gap-1.5"
            >
              <ArrowLeft aria-hidden /> Dán lại
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset()
                onClose()
              }}
            >
              Huỷ
            </Button>
            <Button type="button" disabled={addable === 0} onClick={confirm}>
              <ClipboardPaste aria-hidden />
              Thêm {addable} dòng vào đơn
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
