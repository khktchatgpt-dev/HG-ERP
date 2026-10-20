'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { dongThieuKg, kgDuKienDong } from '@/lib/da-ve'
import {
  Code,
  Consequence,
  NumInput,
  Sheet,
  SheetActions,
  TextArea,
  useToast,
} from '@/components/kit'
import type { DaVeRow } from '@/modules/dept/supply/da-ve.repo'

const so = (n: number) => n.toLocaleString('vi-VN')
/** Số kiểu VN: "1.390" = 1390 · "108,40" = 108,4. */
const docSo = (v: string) => Number(v.replace(/\./g, '').replace(',', '.')) || 0

/**
 * HỘP GHI KG CÂN BỔ SUNG (01/10/2026) — cho phiếu nhập đã ghi sổ mà dòng nhôm /
 * thép chưa có kg cân. Kg là số đo, không đổi tồn; bắt lý do, vết vào Trao đổi
 * của đơn (server: `stockService.ghiKgCanBoSung`).
 */
export function KgCanSheet({ row, onClose }: { row: DaVeRow; onClose: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const dong = dongThieuKg(row.phieu)
  const [kg, setKg] = useState<Record<string, number>>({})
  const [lyDo, setLyDo] = useState('')
  const [busy, setBusy] = useState(false)

  const thieu = dong.filter((l) => !(kg[l.movement_id] > 0)).length
  const why =
    thieu > 0
      ? `Còn ${thieu} dòng chưa ghi kg`
      : lyDo.trim().length < 3
        ? 'Ghi lý do (vì sao ghi kg sau khi đã nhập)'
        : null

  async function luu() {
    if (why) return
    setBusy(true)
    try {
      await api(`/api/dept/warehouse/docs/${row.doc_id}/kg-can`, {
        method: 'POST',
        body: {
          lines: dong.map((l) => ({
            movement_id: l.movement_id,
            qty2_actual: kg[l.movement_id],
          })),
          reason: lyDo.trim(),
        },
      })
      toast.success(
        `Đã ghi kg cân cho ${row.code}`,
        `${dong.length} dòng — vết ghi vào Trao đổi của ${row.po_code}`,
      )
      onClose()
      router.refresh()
    } catch (e) {
      toast.error('Chưa ghi được kg cân', apiErrorText(e))
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      stakes="vua"
      title={`Ghi kg cân · ${row.code}`}
      subtitle={`${row.po_code} · ${row.supplier_name} — đơn trả tiền theo kg cân thực, lúc nhận chưa ghi kg.`}
      footer={
        <>
          {why && <div className="text-k-sm mb-2 text-[var(--warn)]">{why}</div>}
          <SheetActions
            onCancel={onClose}
            onConfirm={() => void luu()}
            confirmLabel="Ghi kg cân"
            busy={busy}
            disabled={!!why}
          />
        </>
      }
    >
      <div className="flex flex-col">
        {dong.map((l) => {
          const du = kgDuKienDong(l)
          return (
            <div
              key={l.movement_id}
              className="grid grid-cols-[96px_minmax(0,1fr)_140px] items-center gap-3 border-b border-[var(--line)] py-2"
            >
              <Code>{l.material_code}</Code>
              <span className="text-k-sm min-w-0">
                <span className="block truncate">
                  {row.lines.find((x) => x.movement_id === l.movement_id)?.material_name}
                </span>
                <span className="num text-[var(--ink-3)]">
                  nhận {so(l.qty)} {l.unit}
                  {du != null ? ` · theo đơn ~${so(du)} kg` : ''}
                </span>
              </span>
              <NumInput
                value={kg[l.movement_id] ? String(kg[l.movement_id]) : ''}
                placeholder="kg cân"
                onCommit={(v) => setKg((m) => ({ ...m, [l.movement_id]: docSo(v) }))}
                aria-label={`Kg cân thực ${l.material_code}`}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-3">
        <div className="text-k-label mb-1 font-bold tracking-[.09em] text-[var(--ink-label)] uppercase">
          Lý do · bắt buộc
        </div>
        <TextArea
          value={lyDo}
          onChange={setLyDo}
          rows={2}
          placeholder="ví dụ: lúc nhận chưa cân, cân lại tại xưởng ngày 01/10"
          aria-label="Lý do ghi kg cân bổ sung"
        />
      </div>
      <Consequence>
        Kg chỉ là số đo — tồn kho không đổi. Kế toán đối chiếu hoá đơn theo kg này; ai
        ghi, lúc nào, trước → sau và lý do hiện ở Trao đổi của đơn.
      </Consequence>
    </Sheet>
  )
}
