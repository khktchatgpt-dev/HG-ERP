'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileSpreadsheet, Sparkles, Trash2, TriangleAlert, Upload } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { MATERIAL_KIND_OPTIONS, SHAPE_OPTIONS, calcPartDerived } from '@/lib/bom-calc'
import type { PartGroupView } from './ProductProfileCards'

/**
 * ĐỌC FILE BOM BẰNG AI → duyệt tay → lưu.
 *
 * Ba nhịp, cố ý tách như luồng nhập báo giá từ Excel (0xxx):
 *   1. chọn nguồn (file đã đính trong hồ sơ, hoặc chọn từ máy)
 *   2. mô hình đọc ra BẢN NHÁP — không ghi gì
 *   3. người dùng soi, sửa, bỏ bớt rồi bấm lưu
 *
 * Nhịp 3 đi qua ĐÚNG route `parts/bulk` mà lưới gõ tay đang dùng — không mở
 * đường ghi riêng cho AI. Nghĩa là mọi dòng vẫn qua `productPartsBulkSchema` và
 * vẫn được `calcPartDerived` tính lại khối lượng, y như dòng gõ tay.
 *
 * Vì sao bày `confidence` và `source_ref` chứ không im lặng nhận hết: đây là số
 * đi thẳng vào giá thành. Cho người kiểm biết dòng nào mô hình tự tin, dòng nào
 * đang đoán, và ô nào trong file gốc đẻ ra dòng đó — thì đây là công cụ nhập
 * nhanh; giấu đi thì thành máy đoán mò không ai dám tin.
 */

/** Dưới ngưỡng này thì tô cảnh báo và tính vào bộ đếm "cần soi". */
const LOW_CONFIDENCE = 0.8

const ACCEPT =
  '.xlsx,.pdf,.png,.jpg,.jpeg,.webp,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf,image/png,image/jpeg,image/webp'

const READABLE = /\.(xlsx|pdf|png|jpe?g|webp)$/i

type ApiLine = {
  part_no: number | null
  part_name: string
  cluster_name: string | null
  profile_shape: string | null
  material_kind: string | null
  dim_a_mm: number | null
  dim_b_mm: number | null
  wall_thickness_mm: number | null
  cut_length_mm: number | null
  bend_waste_mm: number | null
  tenon_mm: number | null
  qty: number | null
  profile_code: string | null
  unit: string | null
  material_note: string | null
  weight_kg: number | null
  note: string | null
  confidence: number
  source_ref: string | null
}

type ApiDraft = {
  sections: {
    group_code: string
    section_title: string | null
    unit_basis: string | null
    lines: ApiLine[]
  }[]
  meta: {
    provider: string
    model: string
    mode: 'grid' | 'document'
    filename: string
    sheets: { name: string; emitted: number }[]
    truncated: string[]
    dropped: number
    lines: number
    existing: { total: number; byGroup: Record<string, number> }
  }
}

type SaveMode = 'append' | 'replace'

type Line = ApiLine & { key: number }
type Section = {
  key: number
  group_code: string
  section_title: string
  unit_basis: string
  include: boolean
  lines: Line[]
}

type ProductFile = { id: string; filename: string; size_bytes: number }

const inp =
  'w-full rounded border border-input bg-background px-1.5 py-1 text-xs focus:border-[var(--primary)] focus:outline-none'
const head =
  'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:border-[var(--primary)] focus:outline-none'

const nOrNull = (v: string) => {
  const s = v.trim().replace(',', '.')
  if (!s) return null
  const x = Number(s)
  return Number.isFinite(x) ? x : null
}
const show = (v: number | null) => (v == null ? '' : String(v))
const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`

/** File → base64 thuần (bỏ tiền tố data:...;base64,). */
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error('Không đọc được file'))
    r.onload = () => {
      const s = String(r.result)
      const i = s.indexOf(',')
      resolve(i >= 0 ? s.slice(i + 1) : s)
    }
    r.readAsDataURL(file)
  })
}

export function BomAiImport({
  productId,
  groups,
  onClose,
}: {
  productId: string
  groups: PartGroupView[]
  onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const seq = useRef(1)
  const [files, setFiles] = useState<ProductFile[]>([])
  const [pickedFileId, setPickedFileId] = useState<string | null>(null)
  const [picked, setPicked] = useState<File | null>(null)
  const [busy, setBusy] = useState<'read' | 'save' | null>(null)
  const [draft, setDraft] = useState<ApiDraft['meta'] | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [onlyLow, setOnlyLow] = useState(false)
  const [mode, setMode] = useState<SaveMode>('append')

  useEffect(() => {
    void (async () => {
      try {
        const d = await api<{ files: ProductFile[] }>(
          `/api/files?product_id=${productId}`,
        )

        setFiles(d.files.filter((f) => READABLE.test(f.filename)))
      } catch {
        /* im lặng — vẫn chọn được file từ máy */
      }
    })()
  }, [productId])

  const patchLine = (sk: number, lk: number, p: Partial<Line>) =>
    setSections((ss) =>
      ss.map((s) =>
        s.key === sk
          ? { ...s, lines: s.lines.map((l) => (l.key === lk ? { ...l, ...p } : l)) }
          : s,
      ),
    )
  const dropLine = (sk: number, lk: number) =>
    setSections((ss) =>
      ss.map((s) =>
        s.key === sk ? { ...s, lines: s.lines.filter((l) => l.key !== lk) } : s,
      ),
    )
  const patchSection = (sk: number, p: Partial<Section>) =>
    setSections((ss) => ss.map((s) => (s.key === sk ? { ...s, ...p } : s)))

  const read = useCallback(async () => {
    if (!picked && !pickedFileId) return
    setBusy('read')
    try {
      const source = picked
        ? {
            kind: 'upload' as const,
            filename: picked.name,
            mime: picked.type,
            data_base64: await toBase64(picked),
          }
        : { kind: 'file' as const, file_id: pickedFileId! }

      const d = await api<ApiDraft>(
        `/api/dept/technical/products/${productId}/parts/ai-extract`,
        { method: 'POST', body: { source } },
      )

      setDraft(d.meta)
      setSections(
        d.sections.map((s) => ({
          key: seq.current++,
          group_code: s.group_code,
          section_title: s.section_title ?? '',
          unit_basis: s.unit_basis ?? '',
          include: true,
          lines: s.lines.map((l) => ({ ...l, key: seq.current++ })),
        })),
      )
      if (d.sections.length === 0) {
        toast.error('Không đọc ra khối định mức nào', 'Kiểm lại xem đúng file BOM chưa')
      } else {
        toast.success(
          `Đọc được ${d.meta.lines} dòng / ${d.sections.length} khối`,
          'Soi lại rồi mới lưu — nhất là các dòng tô vàng',
        )
      }
    } catch (e) {
      toast.error('Đọc file thất bại', apiErrorText(e))
    } finally {
      setBusy(null)
    }
  }, [picked, pickedFileId, productId, toast])

  /** Cả bản nháp trong MỘT lượt — chế độ thay thế phải xoá xong rồi mới ghi. */
  async function save() {
    const active = sections.filter((s) => s.include && s.lines.length > 0)
    if (active.length === 0) return
    setBusy('save')
    try {
      const r = await api<{ added: number; removed: number }>(
        `/api/dept/technical/products/${productId}/parts/ai-apply`,
        {
          method: 'POST',
          body: {
            mode,
            sections: active.map((s) => ({
              group_code: s.group_code,
              section_title: s.section_title.trim() || null,
              unit_basis: s.unit_basis.trim() || null,
              lines: s.lines.map((l) => ({
                part_no: l.part_no,
                part_name: l.part_name.trim(),
                cluster_name: l.cluster_name,
                material_kind: l.material_kind,
                profile_shape: l.profile_shape,
                dim_a_mm: l.dim_a_mm,
                dim_b_mm: l.dim_b_mm,
                wall_thickness_mm: l.wall_thickness_mm,
                cut_length_mm: l.cut_length_mm,
                bend_waste_mm: l.bend_waste_mm,
                tenon_mm: l.tenon_mm,
                qty: l.qty,
                unit: l.unit,
                material_note: l.material_note,
                weight_kg: l.weight_kg,
                note: l.note,
              })),
            })),
          },
        },
      )
      router.refresh()
      toast.success(
        `Đã thêm ${r.added} dòng định mức`,
        r.removed > 0 ? `Đã thay thế ${r.removed} dòng cũ` : undefined,
      )
      onClose()
    } catch (e) {
      setBusy(null)
      toast.error('Lưu thất bại', apiErrorText(e))
    }
  }

  const totalLines = sections.reduce((n, s) => n + (s.include ? s.lines.length : 0), 0)
  /**
   * Số dòng ĐANG CÓ thuộc các nhóm mà bản nháp sẽ đụng tới. Chỉ đếm nhóm giao
   * nhau: hồ sơ có 8 dòng bao bì mà file chỉ nói về khung thì không việc gì phải
   * doạ người dùng.
   */
  const clash = sections
    .filter((s) => s.include && s.lines.length > 0)
    .reduce<{ code: string; label: string; n: number }[]>((acc, s) => {
      if (acc.some((x) => x.code === s.group_code)) return acc
      const n = draft?.existing.byGroup[s.group_code] ?? 0
      if (n === 0) return acc
      const label = groups.find((g) => g.code === s.group_code)?.label ?? s.group_code
      return [...acc, { code: s.group_code, label, n }]
    }, [])
  const clashTotal = clash.reduce((n, c) => n + c.n, 0)
  /**
   * Dòng ĐỌC ĐƯỢC nhưng file bỏ trống cột Số lượng. Không tự điền 1 (mô hình đã
   * bị cấm làm thế) và cũng không loại bỏ — người dùng gõ SL ngay trên lưới.
   * DB có `qty not null check (qty > 0)` nên chưa điền thì chưa lưu được.
   */
  const noQtyCount = sections.reduce(
    (n, s) => n + (s.include ? s.lines.filter((l) => l.qty == null).length : 0),
    0,
  )

  const lowCount = sections.reduce(
    (n, s) =>
      n + (s.include ? s.lines.filter((l) => l.confidence < LOW_CONFIDENCE).length : 0),
    0,
  )

  return (
    <Modal open onClose={onClose} title="Đọc file BOM bằng AI" maxWidth="sm:max-w-7xl">
      <TopProgressBar active={busy !== null} />
      <div className="flex flex-col gap-3">
        {!draft && (
          <>
            <p className="text-muted-foreground text-xs">
              Đọc bảng định mức từ file <b>.xlsx</b> (chính xác nhất — có cả địa chỉ ô
              nguồn), hoặc <b>PDF / ảnh chụp</b> khi không có file gốc. Kết quả là{' '}
              <b>bản nháp</b>: không có gì được ghi vào hồ sơ cho tới khi bạn bấm lưu.
            </p>

            {files.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">File đã đính trong hồ sơ</span>
                <div className="max-h-48 overflow-auto rounded-md border">
                  {files.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setPickedFileId(f.id)
                        setPicked(null)
                      }}
                      className={`flex w-full items-center gap-2 border-b px-3 py-2 text-left text-xs last:border-0 ${
                        pickedFileId === f.id
                          ? 'bg-[var(--accent)] text-[var(--primary)]'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <FileSpreadsheet className="size-3.5 shrink-0" />
                      <span className="truncate">{f.filename}</span>
                      <span className="text-muted-foreground ml-auto shrink-0 tabular-nums">
                        {kb(f.size_bytes)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="flex cursor-pointer flex-col gap-1.5">
              <span className="text-sm font-medium">Hoặc chọn từ máy</span>
              <div className="hover:bg-muted flex items-center gap-2 rounded-md border border-dashed px-3 py-3 text-xs">
                <Upload className="size-4 shrink-0" />
                {picked ? (
                  <span className="truncate">
                    {picked.name}{' '}
                    <span className="text-muted-foreground">({kb(picked.size)})</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Bấm để chọn .xlsx, PDF hoặc ảnh
                  </span>
                )}
              </div>
              <input
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  setPicked(f)
                  if (f) setPickedFileId(null)
                }}
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="hover:bg-muted rounded-md border px-4 py-2 text-sm"
              >
                Huỷ
              </button>
              <button
                type="button"
                disabled={busy !== null || (!picked && !pickedFileId)}
                onClick={() => void read()}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white shadow disabled:opacity-50"
              >
                {busy === 'read' ? (
                  <Spinner size={14} />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {busy === 'read' ? 'Đang đọc…' : 'Đọc file'}
              </button>
            </div>
          </>
        )}

        {draft && (
          <>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-2.5 text-xs">
              <span className="text-foreground font-medium">{draft.filename}</span>
              <span>
                {draft.mode === 'grid'
                  ? `lưới ô · ${draft.sheets.map((s) => `${s.name} (${s.emitted} dòng)`).join(', ')}`
                  : 'đọc dạng tài liệu'}
              </span>
              <span className="ml-auto">
                {draft.provider} · {draft.model}
              </span>
            </div>

            {(draft.truncated.length > 0 || draft.dropped > 0) && (
              <div className="flex items-start gap-2 rounded-md border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] p-2.5 text-xs text-[var(--warn)]">
                <TriangleAlert className="mt-px size-3.5 shrink-0" />
                <div>
                  {draft.truncated.map((t) => (
                    <div key={t}>{t}</div>
                  ))}
                  {draft.dropped > 0 && (
                    <div>
                      {draft.dropped} dòng bị loại vì thiếu tên hoặc số lượng — mở file
                      gốc kiểm lại phần đó.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Hồ sơ đã có định mức ở đúng nhóm sắp ghi → bắt chọn cách xử lý.
                Rất nhiều hồ sơ đã được script nạp sẵn từ chính file BOM này. */}
            {clashTotal > 0 && (
              <div className="flex flex-col gap-2 rounded-md border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] p-3 text-xs">
                <div className="flex items-start gap-2 text-[var(--warn)]">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" />
                  <span>
                    Hồ sơ đã có <b>{clashTotal} dòng</b> ở nhóm{' '}
                    {clash.map((c) => `${c.label} (${c.n})`).join(', ')}.
                  </span>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-start gap-1.5">
                    <input
                      type="radio"
                      name="bom-save-mode"
                      className="mt-0.5"
                      checked={mode === 'append'}
                      onChange={() => setMode('append')}
                    />
                    <span>
                      <b>Thêm vào</b>
                      <span className="text-muted-foreground block">
                        giữ nguyên dòng cũ → hồ sơ thành {clashTotal + totalLines} dòng
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-1.5">
                    <input
                      type="radio"
                      name="bom-save-mode"
                      className="mt-0.5"
                      checked={mode === 'replace'}
                      onChange={() => setMode('replace')}
                    />
                    <span>
                      <b>Thay thế</b>
                      <span className="text-muted-foreground block">
                        xoá {clashTotal} dòng cũ của các nhóm trên rồi ghi mới
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-muted-foreground">
                {totalLines} dòng sẽ lưu
                {lowCount > 0 && (
                  <>
                    {' · '}
                    <b className="text-[var(--warn)]">{lowCount} dòng cần soi</b>
                  </>
                )}
                {noQtyCount > 0 && (
                  <>
                    {' · '}
                    <b className="text-[var(--stop)]">{noQtyCount} dòng thiếu SL</b>
                  </>
                )}
              </span>
              {lowCount > 0 && (
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={onlyLow}
                    onChange={(e) => setOnlyLow(e.target.checked)}
                  />
                  Chỉ hiện dòng cần soi
                </label>
              )}
            </div>

            <div className="flex max-h-[52vh] flex-col gap-4 overflow-auto">
              {sections.map((s) => {
                const visible = onlyLow
                  ? s.lines.filter((l) => l.confidence < LOW_CONFIDENCE)
                  : s.lines
                if (onlyLow && visible.length === 0) return null
                return (
                  <div
                    key={s.key}
                    className={`rounded-md border ${s.include ? '' : 'opacity-50'}`}
                  >
                    <div className="bg-muted/40 flex flex-wrap items-center gap-2 border-b p-2.5">
                      <input
                        type="checkbox"
                        checked={s.include}
                        onChange={(e) =>
                          patchSection(s.key, { include: e.target.checked })
                        }
                        title="Bỏ chọn để không lưu khối này"
                      />
                      <select
                        value={s.group_code}
                        onChange={(e) =>
                          patchSection(s.key, { group_code: e.target.value })
                        }
                        className={`${head} w-44`}
                      >
                        {groups.map((g) => (
                          <option key={g.code} value={g.code}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                      <input
                        value={s.section_title}
                        onChange={(e) =>
                          patchSection(s.key, { section_title: e.target.value })
                        }
                        placeholder="Tiêu đề khối"
                        className={`${head} min-w-0 flex-1`}
                      />
                      <input
                        value={s.unit_basis}
                        onChange={(e) =>
                          patchSection(s.key, { unit_basis: e.target.value })
                        }
                        placeholder="ĐVT khối"
                        className={`${head} w-28`}
                      />
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {s.lines.length} dòng
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground border-b text-left uppercase">
                            <th className="w-10 py-1.5 pl-2.5 font-medium">Tin</th>
                            <th className="w-52 py-1.5 pr-2 font-medium">Tên chi tiết</th>
                            <th className="w-28 py-1.5 pr-2 font-medium">Cụm</th>
                            <th className="w-20 py-1.5 pr-2 font-medium">Dạng</th>
                            <th className="w-16 py-1.5 pr-2 font-medium">Hệ VL</th>
                            <th className="w-14 py-1.5 pr-2 font-medium">Dày A</th>
                            <th className="w-14 py-1.5 pr-2 font-medium">Rộng B</th>
                            <th className="w-14 py-1.5 pr-2 font-medium">Dày thành</th>
                            <th className="w-16 py-1.5 pr-2 font-medium">Dài cắt</th>
                            <th className="w-14 py-1.5 pr-2 font-medium">SL</th>
                            <th className="w-14 py-1.5 pr-2 font-medium">ĐVT</th>
                            <th className="w-20 py-1.5 pr-2 text-right font-medium">
                              KL tính
                            </th>
                            <th className="w-8 py-1.5" />
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((l) => {
                            const low = l.confidence < LOW_CONFIDENCE
                            const d = calcPartDerived({
                              profile_shape: l.profile_shape,
                              material_kind: l.material_kind,
                              dim_a_mm: l.dim_a_mm,
                              dim_b_mm: l.dim_b_mm,
                              wall_thickness_mm: l.wall_thickness_mm,
                              cut_length_mm: l.cut_length_mm,
                              qty: l.qty,
                            })
                            return (
                              <tr
                                key={l.key}
                                className={`border-b last:border-0 ${
                                  l.qty == null
                                    ? 'bg-[color-mix(in_srgb,var(--stop)_10%,transparent)]'
                                    : low
                                      ? 'bg-[color-mix(in_srgb,var(--warn)_8%,transparent)]'
                                      : ''
                                }`}
                              >
                                <td className="py-1 pl-2.5">
                                  <span
                                    title={
                                      l.source_ref
                                        ? `Nguồn: ${l.source_ref}`
                                        : 'Không rõ ô nguồn'
                                    }
                                    className={`font-mono text-[11px] tabular-nums ${
                                      low
                                        ? 'font-semibold text-[var(--warn)]'
                                        : 'text-muted-foreground'
                                    }`}
                                  >
                                    {Math.round(l.confidence * 100)}
                                  </span>
                                </td>
                                <td className="py-1 pr-2">
                                  <input
                                    value={l.part_name}
                                    onChange={(e) =>
                                      patchLine(s.key, l.key, {
                                        part_name: e.target.value,
                                      })
                                    }
                                    className={inp}
                                  />
                                </td>
                                <td className="py-1 pr-2">
                                  <input
                                    value={l.cluster_name ?? ''}
                                    onChange={(e) =>
                                      patchLine(s.key, l.key, {
                                        cluster_name: e.target.value || null,
                                      })
                                    }
                                    className={inp}
                                  />
                                </td>
                                <td className="py-1 pr-2">
                                  <select
                                    value={l.profile_shape ?? ''}
                                    onChange={(e) =>
                                      patchLine(s.key, l.key, {
                                        profile_shape: e.target.value || null,
                                      })
                                    }
                                    className={inp}
                                  >
                                    <option value="">—</option>
                                    {SHAPE_OPTIONS.map((o) => (
                                      <option key={o.code} value={o.code}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-1 pr-2">
                                  <select
                                    value={l.material_kind ?? ''}
                                    onChange={(e) =>
                                      patchLine(s.key, l.key, {
                                        material_kind: e.target.value || null,
                                      })
                                    }
                                    className={inp}
                                  >
                                    <option value="">—</option>
                                    {MATERIAL_KIND_OPTIONS.map((o) => (
                                      <option key={o.code} value={o.code}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                {(
                                  [
                                    ['dim_a_mm', l.dim_a_mm],
                                    ['dim_b_mm', l.dim_b_mm],
                                    ['wall_thickness_mm', l.wall_thickness_mm],
                                    ['cut_length_mm', l.cut_length_mm],
                                    ['qty', l.qty],
                                  ] as const
                                ).map(([field, val]) => (
                                  <td key={field} className="py-1 pr-2">
                                    <input
                                      value={show(val)}
                                      onChange={(e) =>
                                        patchLine(s.key, l.key, {
                                          [field]: nOrNull(e.target.value),
                                        })
                                      }
                                      className={`${inp} text-right`}
                                      inputMode="decimal"
                                    />
                                  </td>
                                ))}
                                <td className="py-1 pr-2">
                                  <input
                                    value={l.unit ?? ''}
                                    onChange={(e) =>
                                      patchLine(s.key, l.key, {
                                        unit: e.target.value || null,
                                      })
                                    }
                                    className={inp}
                                  />
                                </td>
                                <td className="text-muted-foreground py-1 pr-2 text-right tabular-nums">
                                  {d.weight_kg != null ? d.weight_kg.toFixed(3) : ''}
                                </td>
                                <td className="py-1 pr-1">
                                  <button
                                    type="button"
                                    onClick={() => dropLine(s.key, l.key)}
                                    title="Bỏ dòng này"
                                    className="hover:bg-muted rounded p-1"
                                  >
                                    <Trash2 className="text-muted-foreground size-3.5" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(null)
                  setSections([])
                  setOnlyLow(false)
                }}
                className="text-xs font-medium text-[var(--primary)] hover:underline"
              >
                ← Đọc file khác
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="hover:bg-muted rounded-md border px-4 py-2 text-sm"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  disabled={busy !== null || totalLines === 0 || noQtyCount > 0}
                  title={
                    noQtyCount > 0
                      ? `Còn ${noQtyCount} dòng chưa có số lượng — điền ô SL (dòng tô đỏ) rồi mới lưu được`
                      : undefined
                  }
                  onClick={() => void save()}
                  className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white shadow disabled:opacity-50"
                >
                  {busy === 'save' && <Spinner size={14} />}
                  {busy === 'save'
                    ? 'Đang lưu…'
                    : noQtyCount > 0
                      ? `Điền SL cho ${noQtyCount} dòng còn thiếu`
                      : mode === 'replace' && clashTotal > 0
                        ? `Thay ${clashTotal} dòng bằng ${totalLines} dòng`
                        : `Lưu ${totalLines} dòng`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
