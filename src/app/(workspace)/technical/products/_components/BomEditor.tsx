'use client'

import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Badge } from '@/components/shadcn/badge'
import { Button } from '@/components/shadcn/button'
import { Spinner } from '@/components/erp/Spinner'
import {
  ACCENT_SOLID,
  BOM_BADGE,
  BOM_LABEL,
  type BomRow,
  type BomStatus,
  type MaterialOption,
} from './types'

/** Biên tập định mức vật tư của 1 SP (FR-ENG-04). */
export function BomEditor({
  initialRows,
  bomStatus,
  materials,
  canEdit,
  onSave,
}: {
  initialRows: BomRow[]
  bomStatus: BomStatus
  materials: MaterialOption[]
  canEdit: boolean
  onSave: (
    rows: { material_id: string; qty_per_unit: number; note: string }[],
  ) => Promise<void>
}) {
  const [rows, setRows] = useState<BomRow[]>(initialRows)
  const [busy, setBusy] = useState(false)
  const cls =
    'w-full rounded-md border px-2 py-1.5 text-sm bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'

  const materialById = useMemo(() => {
    const m = new Map<string, MaterialOption>()
    for (const mt of materials) m.set(mt.id, mt)
    return m
  }, [materials])

  const usedIds = new Set(rows.map((r) => r.material_id))
  const dup = rows.length !== usedIds.size

  function setRow(i: number, patch: Partial<BomRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  async function handleSave() {
    const clean = rows.filter((r) => r.material_id)
    if (clean.some((r) => r.qty_per_unit === '' || Number(r.qty_per_unit) <= 0)) {
      return // nút save đã disable, đây chỉ là chốt chặn
    }
    setBusy(true)
    await onSave(
      clean.map((r) => ({
        material_id: r.material_id,
        qty_per_unit: Number(r.qty_per_unit),
        note: r.note,
      })),
    )
    setBusy(false)
  }

  const invalid =
    dup ||
    rows.some(
      (r) => !r.material_id || r.qty_per_unit === '' || Number(r.qty_per_unit) <= 0,
    )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          Định mức vật tư cho <b>1 sản phẩm</b> — mã vật tư dùng chung với danh mục Kho.
        </span>
        <Badge className={`border-transparent ${BOM_BADGE[bomStatus]}`}>
          {BOM_LABEL[bomStatus]}
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs uppercase">
              <th className="py-2 pr-2">Vật tư</th>
              <th className="w-28 py-2 pr-2">Định mức / SP</th>
              <th className="w-16 py-2 pr-2">ĐVT</th>
              <th className="py-2 pr-2">Ghi chú</th>
              {canEdit && <th className="w-10 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted-foreground py-6 text-center">
                  Chưa có dòng vật tư nào.
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              const mat = materialById.get(r.material_id)
              return (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1.5 pr-2">
                    {canEdit ? (
                      <select
                        value={r.material_id}
                        onChange={(e) => setRow(i, { material_id: e.target.value })}
                        className={cls}
                      >
                        <option value="">— chọn vật tư —</option>
                        {materials.map((m) => (
                          <option
                            key={m.id}
                            value={m.id}
                            disabled={usedIds.has(m.id) && m.id !== r.material_id}
                          >
                            {m.code} — {m.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>
                        <span className="text-muted-foreground font-mono text-xs">
                          {mat?.code}
                        </span>{' '}
                        {mat?.name ?? '?'}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2">
                    {canEdit ? (
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={r.qty_per_unit}
                        onChange={(e) =>
                          setRow(i, {
                            qty_per_unit:
                              e.target.value === '' ? '' : Number(e.target.value),
                          })
                        }
                        className={cls}
                      />
                    ) : (
                      String(r.qty_per_unit)
                    )}
                  </td>
                  <td className="text-muted-foreground py-1.5 pr-2">{mat?.unit ?? ''}</td>
                  <td className="py-1.5 pr-2">
                    {canEdit ? (
                      <input
                        value={r.note}
                        maxLength={500}
                        onChange={(e) => setRow(i, { note: e.target.value })}
                        className={cls}
                        placeholder="vd: chân trước, khung ngồi…"
                      />
                    ) : (
                      r.note || '—'
                    )}
                  </td>
                  {canEdit && (
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded p-1"
                        aria-label="Xoá dòng"
                      >
                        <X className="size-4" />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {dup && <p className="text-destructive text-xs">Có vật tư bị chọn trùng 2 dòng.</p>}

      {canEdit && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() =>
              setRows((rs) => [...rs, { material_id: '', qty_per_unit: '', note: '' }])
            }
            className="text-muted-foreground inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-sm hover:border-sky-400 hover:text-sky-600 dark:hover:border-sky-700 dark:hover:text-sky-400"
          >
            <Plus className="size-4" /> Thêm dòng vật tư
          </button>
          <Button
            disabled={busy || invalid}
            onClick={() => void handleSave()}
            className={ACCENT_SOLID}
          >
            {busy && <Spinner size={14} />}
            {busy ? 'Đang lưu…' : 'Lưu BOM'}
          </Button>
        </div>
      )}
    </div>
  )
}
