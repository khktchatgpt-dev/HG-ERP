'use client'

import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Copy, Layers, Pencil, Search } from 'lucide-react'
import { Card } from '@/components/shadcn/card'
import { Separator } from '@/components/shadcn/separator'
import { cn } from '@/lib/utils'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PartLineEdit } from './PartLineEdit'
import { PartsCopyDialog } from './PartsCopyDialog'
import { PartsBulkEntry } from './PartsBulkEntry'
import { PartRowInline, PartRowNew } from './PartRowInline'
import type { PartGroupView, PartView } from './ProductProfileCards'

const n = (v: number | null | undefined, d = 0) =>
  v == null ? null : v.toLocaleString('en-US', { maximumFractionDigits: d })

const SHAPE_LABEL: Record<string, string> = {
  HOP: 'hộp',
  TRON: 'tròn',
  TRONDAC: 'tròn đặc',
  VUONG: 'vuông',
  LA: 'la',
  OVAN: 'ovan',
  OVANXR: 'ovan xẻ rãnh',
  TAM: 'tấm',
  LUOI: 'lưới',
  V: 'V',
  C: 'C',
  L: 'L',
  PF: 'profile',
}

/**
 * Quy cách gọn: "hộp 20×40 dày 1" · "tròn Ø27 dày 0.8" · "vuông 20 dày 0.8".
 * Tròn/vuông tiết diện đều nên chỉ nêu một chiều — ghi "27×27" là thừa.
 */
export function specOf(p: PartView): string | null {
  if (p.profile_code) return p.profile_code
  const shape = p.profile_shape ? (SHAPE_LABEL[p.profile_shape] ?? p.profile_shape) : null
  const { dim_a_mm: a, dim_b_mm: b } = p
  let core: string | null = null
  if (p.profile_shape === 'TRON' || p.profile_shape === 'TRONDAC')
    core = a != null ? `Ø${n(a, 1)}` : null
  else if (p.profile_shape === 'VUONG') core = n(a, 1)
  else {
    const dims = [a, b].filter((x) => x != null)
    core = dims.length ? dims.map((x) => n(x, 1)).join('×') : null
  }
  const wall =
    p.wall_thickness_mm != null &&
    p.profile_shape !== 'TRONDAC' &&
    p.profile_shape !== 'LA'
      ? `dày ${n(p.wall_thickness_mm, 2)}`
      : null
  return [shape, core, wall].filter(Boolean).join(' ') || null
}

const haystack = (p: PartView) =>
  [
    p.part_name,
    p.set_item_label,
    p.section_title,
    p.material_note,
    p.tenon,
    p.material_code,
    p.profile_code,
    specOf(p),
    p.note,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

/** Khối định mức: một tiêu đề + các dòng thuộc nó. */
type Section = { title: string | null; unitBasis: string | null; rows: PartView[] }
type SubGroup = {
  label: string | null
  rows: PartView[]
  kg: number
  sections: Section[]
}
type Group = {
  code: string
  label: string
  rows: PartView[]
  kg: number
  subs: SubGroup[]
}

const sumKg = (rows: PartView[]) => rows.reduce((s, p) => s + (p.weight_kg ?? 0), 0)

/** Gom theo tiêu đề khối, giữ thứ tự xuất hiện. */
function toSections(rows: PartView[]): Section[] {
  const out: Section[] = []
  for (const p of rows) {
    const last = out[out.length - 1]
    if (last && last.title === (p.section_title ?? null)) last.rows.push(p)
    else
      out.push({
        title: p.section_title ?? null,
        unitBasis: p.unit_basis ?? null,
        rows: [p],
      })
  }
  return out
}

/**
 * Định mức chi tiết. Hai chế độ: xem (đủ 10 cột như biểu mẫu) và **nhập tại chỗ**
 * — bật lên thì ô trong bảng thành ô nhập, mỗi khối có một dòng trống ở cuối để
 * gõ thêm. Không phải mở hộp thoại nào.
 */
export function ProductPartsCard({
  parts,
  partGroups,
  productId,
  canEdit,
}: {
  parts: PartView[]
  partGroups: PartGroupView[]
  productId: string
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = useState<{ part: PartView | null; group: string } | null>(
    null,
  )
  const [q, setQ] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const [bulk, setBulk] = useState(false)
  const [inline, setInline] = useState(false)
  /**
   * Khối đang tạo mới. Cần riêng vì dòng nhập nằm TRONG khối, mà khối lại suy từ
   * các dòng đã có — sản phẩm chưa có định mức thì không có chỗ nào để gõ.
   */
  const [newSec, setNewSec] = useState<{
    group: string
    title: string
    unitBasis: string
    setLabel: string
    material: string
  } | null>(null)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? parts.filter((p) => haystack(p).includes(needle)) : parts
  }, [parts, q])

  const groups: Group[] = useMemo(() => {
    const byGroup = new Map<string, PartView[]>()
    for (const p of filtered)
      byGroup.set(p.group_code, [...(byGroup.get(p.group_code) ?? []), p])

    const order = [...partGroups].sort((a, b) => a.sort_order - b.sort_order)
    const codes = [
      ...order.filter((g) => byGroup.has(g.code)).map((g) => [g.code, g.label] as const),
      // Mã nhóm lạ (nhóm vừa bị ẩn khỏi danh mục) vẫn phải hiện, không nuốt dòng.
      ...[...byGroup.keys()]
        .filter((c) => !order.some((g) => g.code === c))
        .map((c) => [c, c] as const),
    ]

    return codes.map(([code, label]) => {
      const rows = byGroup.get(code)!
      const bySub = new Map<string, PartView[]>()
      for (const p of rows) {
        const k = p.set_item_label ?? ''
        bySub.set(k, [...(bySub.get(k) ?? []), p])
      }
      // Chỉ tách theo món khi SP thực sự là bộ — 1 món thì tách chỉ thêm nhiễu.
      const subs: SubGroup[] =
        bySub.size > 1
          ? [...bySub.entries()].map(([k, r]) => ({
              label: k || null,
              rows: r,
              kg: sumKg(r),
              sections: toSections(r),
            }))
          : [{ label: null, rows, kg: 0, sections: toSections(rows) }]
      return { code, label, rows, kg: sumKg(rows), subs }
    })
  }, [filtered, partGroups])

  const [closed, setClosed] = useState<string[]>(() =>
    // SP nhiều dòng thì mặc định chỉ mở nhóm đầu, tránh đổ một bảng dài lê thê.
    parts.length > 40 ? partGroups.slice(1).map((g) => g.code) : [],
  )
  const isOpen = (g: string) => !closed.includes(g) || q.trim() !== '' || inline
  const toggle = (g: string) =>
    setClosed((c) => (c.includes(g) ? c.filter((x) => x !== g) : [...c, g]))

  async function duplicate(p: PartView) {
    setBusyId(p.id)
    try {
      await api(`/api/dept/technical/products/${productId}/parts`, {
        method: 'POST',
        body: {
          group_code: p.group_code,
          section_title: p.section_title,
          unit_basis: p.unit_basis,
          part_name: `${p.part_name} (bản sao)`,
          set_item_label: p.set_item_label,
          material_code: p.material_code,
          material_kind: p.material_kind,
          material_note: p.material_note,
          tenon: p.tenon,
          profile_shape: p.profile_shape,
          profile_code: p.profile_code,
          dim_a_mm: p.dim_a_mm,
          dim_b_mm: p.dim_b_mm,
          wall_thickness_mm: p.wall_thickness_mm,
          cut_length_mm: p.cut_length_mm,
          qty: p.qty,
          unit: p.unit,
          waste_pct: p.waste_pct,
          weight_kg: p.weight_kg,
          note: p.note,
        },
      })
      router.refresh()
      toast.success('Đã nhân bản dòng', p.part_name)
    } catch (err) {
      toast.error('Nhân bản thất bại', apiErrorText(err))
    } finally {
      setBusyId(null)
    }
  }

  if (parts.length === 0 && !canEdit) return null

  const totalKg = sumKg(parts)
  const firstGroup = partGroups[0]?.code ?? 'FRAME'
  const hasQuery = q.trim() !== ''
  /** Số cột của bảng theo chế độ — dùng cho dải tiêu đề khối. */
  const cols = inline ? 12 : canEdit ? 11 : 10

  const openNewSection = () =>
    setNewSec({ group: firstGroup, title: '', unitBasis: '', setLabel: '', material: '' })

  const headInp =
    'rounded border border-zinc-300 px-2 py-1 text-xs focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  /** Khối mới: khai tiêu đề rồi gõ dòng ngay bên dưới. */
  const newSectionBlock = newSec && (
    <div className="mt-3 rounded-md border border-sky-300 bg-sky-50/50 p-3 dark:border-sky-800 dark:bg-sky-950/20">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">Khối mới</span>
        <select
          value={newSec.group}
          onChange={(e) => setNewSec({ ...newSec, group: e.target.value })}
          className={headInp}
          aria-label="Nhóm hạng mục"
        >
          {partGroups.map((g) => (
            <option key={g.code} value={g.code}>
              {g.label}
            </option>
          ))}
        </select>
        <input
          value={newSec.title}
          onChange={(e) => setNewSec({ ...newSec, title: e.target.value })}
          className={`${headInp} w-56`}
          placeholder="Tiêu đề khối, vd: Quy cách :"
          aria-label="Tiêu đề khối"
        />
        <select
          value={newSec.material}
          onChange={(e) => setNewSec({ ...newSec, material: e.target.value })}
          className={headInp}
          aria-label="Vật liệu"
        >
          <option value="">Vật liệu —</option>
          <option value="AL">Nhôm</option>
          <option value="IR">Sắt</option>
          <option value="IN">Inox</option>
          <option value="WD">Gỗ</option>
          <option value="RA">Mây / nhựa đan</option>
          <option value="GL">Kính</option>
        </select>
        <input
          value={newSec.setLabel}
          onChange={(e) => setNewSec({ ...newSec, setLabel: e.target.value })}
          className={`${headInp} w-28`}
          placeholder="Món trong bộ"
          aria-label="Món trong bộ"
        />
        <input
          value={newSec.unitBasis}
          onChange={(e) => setNewSec({ ...newSec, unitBasis: e.target.value })}
          className={`${headInp} w-32`}
          placeholder="ĐV tính của khối"
          aria-label="Đơn vị tính của khối"
        />
        <button
          type="button"
          onClick={() => setNewSec(null)}
          className="text-muted-foreground ml-auto text-xs hover:underline"
        >
          Đóng khối
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-[11px] uppercase">
              <th className="w-10 py-1.5 pr-1 text-right font-medium">STT</th>
              <th className="w-52 py-1.5 pr-2 font-medium">Chi tiết</th>
              <th className="w-24 py-1.5 pr-2 font-medium">Dạng</th>
              <th className="w-16 py-1.5 pr-1 font-medium">Dày A</th>
              <th className="w-16 py-1.5 pr-1 font-medium">Rộng B</th>
              <th className="w-16 py-1.5 pr-1 font-medium">Dày thành</th>
              <th className="w-20 py-1.5 pr-1 font-medium">Dài cắt</th>
              <th className="w-16 py-1.5 pr-1 font-medium">SL</th>
              <th className="w-14 py-1.5 pr-1 font-medium">ĐVT</th>
              <th className="w-20 py-1.5 pr-2 text-right font-medium">KL</th>
              <th className="py-1.5 pr-1 font-medium">Ghi chú</th>
              <th className="w-16 py-1.5" />
            </tr>
          </thead>
          <tbody>
            <PartRowNew
              productId={productId}
              groupCode={newSec.group}
              sectionTitle={newSec.title.trim() || null}
              unitBasis={newSec.unitBasis.trim() || null}
              setItemLabel={newSec.setLabel.trim() || null}
              materialKind={newSec.material || null}
              colSpanExtra={1}
            />
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        Gõ tên chi tiết và số lượng rồi Enter — dòng được thêm vào khối này, con trỏ về ô
        tên để gõ tiếp.
      </p>
    </div>
  )

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-5 pt-4 pb-3">
        <Layers className="text-muted-foreground size-4 shrink-0" />
        <h2 className="text-sm font-semibold">Định mức chi tiết</h2>
        <span className="text-muted-foreground text-xs">
          · {hasQuery ? `${filtered.length}/${parts.length}` : parts.length} dòng
          {totalKg > 0 && ` · ${totalKg.toFixed(2)} kg`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {parts.length > 8 && !inline && (
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm chi tiết, quy cách, mã…"
                className="w-44 rounded-md border border-zinc-300 py-1 pr-2 pl-7 text-xs focus:border-sky-500 focus:outline-none sm:w-56 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          )}
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => setCopying(true)}
                className="text-primary shrink-0 text-xs font-medium hover:underline"
              >
                Chép từ SP khác
              </button>
              <button
                type="button"
                onClick={() => setBulk(true)}
                className="text-primary shrink-0 text-xs font-medium hover:underline"
              >
                Dán từ Excel
              </button>
              <button
                type="button"
                onClick={() => {
                  setInline((v) => !v)
                  setQ('')
                }}
                className={cn(
                  'shrink-0 rounded-md border px-2 py-1 text-xs font-medium',
                  inline
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'hover:bg-muted text-muted-foreground',
                )}
              >
                {inline ? 'Xong' : 'Nhập tại chỗ'}
              </button>
            </>
          )}
        </div>
      </div>

      {inline && (
        <p className="text-muted-foreground border-y bg-sky-50/60 px-5 py-2 text-xs dark:bg-sky-950/30">
          Sửa thẳng trong ô, rời khỏi dòng hoặc bấm Enter là lưu. Dòng trống cuối mỗi khối
          để gõ thêm — Enter xong con trỏ tự về ô tên để nhập tiếp. Khối lượng, tổng dài
          và diện tích sơn tự tính.
        </p>
      )}
      {!inline && <Separator />}

      {filtered.length === 0 ? (
        <div className="px-5 py-4">
          <p className="text-muted-foreground text-center text-sm">
            {hasQuery
              ? `Không có dòng nào khớp “${q.trim()}”.`
              : inline
                ? 'Chưa có dòng nào — tạo khối đầu tiên rồi gõ chi tiết vào đó.'
                : 'Chưa bóc tách định mức. Bấm “Nhập tại chỗ” để bắt đầu gõ, hoặc “Dán từ Excel”.'}
          </p>
          {/* SP chưa có định mức: phải có lối tạo khối, không thì bật "Nhập tại
              chỗ" ra bảng trống không có ô nào để gõ. */}
          {inline && !hasQuery && !newSec && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={openNewSection}
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-sky-700"
              >
                + Tạo khối đầu tiên
              </button>
            </div>
          )}
          {inline && newSectionBlock}
        </div>
      ) : (
        <div className="divide-y">
          {groups.map((g) => {
            const open = isOpen(g.code)
            return (
              <div key={g.code}>
                <button
                  type="button"
                  onClick={() => toggle(g.code)}
                  className="hover:bg-muted/50 flex w-full items-center gap-2 px-5 py-2.5 text-left"
                >
                  <ChevronRight
                    className={cn(
                      'text-muted-foreground size-4 shrink-0 transition-transform',
                      open && 'rotate-90',
                    )}
                  />
                  <span className="text-sm font-medium">{g.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {g.rows.length} dòng
                  </span>
                  {g.kg > 0 && (
                    <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                      {g.kg.toFixed(2)} kg
                    </span>
                  )}
                </button>

                {open && (
                  <div className="px-5 pb-3">
                    {g.subs.map((sub, si) => (
                      <div key={sub.label ?? si} className={si > 0 ? 'mt-4' : ''}>
                        {sub.label && (
                          <div className="mb-1 flex items-baseline gap-2">
                            <span className="text-xs font-semibold">{sub.label}</span>
                            <span className="text-muted-foreground text-[11px]">
                              {sub.rows.length} dòng
                              {sub.kg > 0 && ` · ${sub.kg.toFixed(2)} kg`}
                            </span>
                          </div>
                        )}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              {inline ? (
                                <tr className="text-muted-foreground border-b text-left text-[11px] uppercase">
                                  <th className="w-10 py-1.5 pr-1 text-right font-medium">
                                    STT
                                  </th>
                                  <th className="w-52 py-1.5 pr-2 font-medium">
                                    Chi tiết
                                  </th>
                                  <th className="w-24 py-1.5 pr-2 font-medium">Dạng</th>
                                  <th className="w-16 py-1.5 pr-1 font-medium">Dày A</th>
                                  <th className="w-16 py-1.5 pr-1 font-medium">Rộng B</th>
                                  <th className="w-16 py-1.5 pr-1 font-medium">
                                    Dày thành
                                  </th>
                                  <th className="w-20 py-1.5 pr-1 font-medium">
                                    Dài cắt
                                  </th>
                                  <th className="w-16 py-1.5 pr-1 font-medium">SL</th>
                                  <th className="w-14 py-1.5 pr-1 font-medium">ĐVT</th>
                                  <th className="w-20 py-1.5 pr-2 text-right font-medium">
                                    KL
                                  </th>
                                  <th className="py-1.5 pr-1 font-medium">Ghi chú</th>
                                  <th className="w-16 py-1.5" />
                                </tr>
                              ) : (
                                <tr className="text-muted-foreground border-b text-left text-[11px] uppercase">
                                  <th className="w-8 py-1.5 pr-2 text-right font-medium">
                                    STT
                                  </th>
                                  <th className="py-1.5 pr-3 font-medium">Chi tiết</th>
                                  <th className="py-1.5 pr-3 font-medium">Quy cách</th>
                                  <th className="py-1.5 pr-3 text-right font-medium">
                                    Dài cắt
                                  </th>
                                  <th className="py-1.5 pr-3 text-right font-medium">
                                    SL
                                  </th>
                                  <th className="py-1.5 pr-3 text-right font-medium">
                                    Tổng dài
                                  </th>
                                  <th className="py-1.5 pr-3 text-right font-medium">
                                    KL
                                  </th>
                                  <th className="py-1.5 pr-3 text-right font-medium">
                                    DT sơn
                                  </th>
                                  <th className="py-1.5 pr-3 font-medium">Mã vật tư</th>
                                  <th className="py-1.5 font-medium">Ghi chú</th>
                                  {canEdit && <th className="w-14 py-1.5" />}
                                </tr>
                              )}
                            </thead>
                            <tbody>
                              {sub.sections.map((sec, sx) => (
                                <Fragment key={`${sec.title ?? ''}-${sx}`}>
                                  {sec.title && (
                                    <tr className="bg-muted/40">
                                      <td colSpan={cols} className="px-1 py-1.5">
                                        <span className="text-xs font-semibold">
                                          {sec.title}
                                        </span>
                                        {sec.unitBasis && (
                                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-px text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                            định mức tính cho {sec.unitBasis}, không phải
                                            1 sản phẩm
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  )}

                                  {sec.rows.map((p) =>
                                    inline ? (
                                      <PartRowInline
                                        key={p.id}
                                        productId={productId}
                                        part={p}
                                        colSpanExtra={1}
                                        onDeleted={() => setBusyId(null)}
                                      />
                                    ) : (
                                      <tr
                                        key={p.id}
                                        className={cn(
                                          'group border-b last:border-0',
                                          canEdit && 'hover:bg-muted/40',
                                          busyId === p.id && 'opacity-50',
                                        )}
                                      >
                                        <td className="text-muted-foreground py-1.5 pr-2 text-right text-xs tabular-nums">
                                          {p.part_no ?? ''}
                                        </td>
                                        <td className="py-1.5 pr-3">
                                          {p.part_name}
                                          {!sub.label && p.set_item_label && (
                                            <span className="text-muted-foreground ml-1.5 text-xs">
                                              ({p.set_item_label})
                                            </span>
                                          )}
                                          {p.tenon && (
                                            <span className="text-muted-foreground ml-1.5 text-xs">
                                              mộng {p.tenon}
                                            </span>
                                          )}
                                          {p.waste_pct > 0 && (
                                            <span className="ml-1.5 rounded bg-amber-100 px-1 py-px text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                                              hao {n(p.waste_pct, 2)}%
                                            </span>
                                          )}
                                        </td>
                                        <td className="text-muted-foreground py-1.5 pr-3 text-xs">
                                          {specOf(p) ?? '—'}
                                          {p.material_note && (
                                            <span className="ml-1 opacity-80">
                                              · {p.material_note}
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-1.5 pr-3 text-right tabular-nums">
                                          {n(p.cut_length_mm, 1) ?? '—'}
                                        </td>
                                        <td className="py-1.5 pr-3 text-right tabular-nums">
                                          {n(p.qty, 4)}
                                          {p.unit ? (
                                            <span className="text-muted-foreground">
                                              {' '}
                                              {p.unit}
                                            </span>
                                          ) : null}
                                        </td>
                                        <td className="text-muted-foreground py-1.5 pr-3 text-right tabular-nums">
                                          {p.total_length_m != null
                                            ? p.total_length_m.toFixed(2)
                                            : '—'}
                                        </td>
                                        <td className="py-1.5 pr-3 text-right tabular-nums">
                                          {p.weight_kg != null
                                            ? p.weight_kg.toFixed(3)
                                            : '—'}
                                        </td>
                                        <td className="text-muted-foreground py-1.5 pr-3 text-right tabular-nums">
                                          {p.paint_area_m2 != null
                                            ? p.paint_area_m2.toFixed(4)
                                            : '—'}
                                        </td>
                                        <td className="text-muted-foreground py-1.5 pr-3 font-mono text-[11px]">
                                          {p.material_code ?? '—'}
                                        </td>
                                        <td
                                          className="text-muted-foreground max-w-40 truncate py-1.5 text-xs"
                                          title={p.note ?? undefined}
                                        >
                                          {p.note ?? ''}
                                        </td>
                                        {canEdit && (
                                          <td className="py-1.5">
                                            {/* Hiện khi rê chuột / focus bàn phím */}
                                            <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                                              <button
                                                type="button"
                                                title="Nhân bản dòng"
                                                disabled={busyId === p.id}
                                                onClick={() => void duplicate(p)}
                                                className="hover:bg-muted rounded p-1 disabled:opacity-40"
                                              >
                                                <Copy className="text-muted-foreground size-3.5" />
                                              </button>
                                              <button
                                                type="button"
                                                title="Sửa dòng"
                                                onClick={() =>
                                                  setEditing({ part: p, group: g.code })
                                                }
                                                className="hover:bg-muted rounded p-1"
                                              >
                                                <Pencil className="text-muted-foreground size-3.5" />
                                              </button>
                                            </div>
                                          </td>
                                        )}
                                      </tr>
                                    ),
                                  )}

                                  {/* Dòng trống cuối khối — vòng "tạo trực tiếp". */}
                                  {inline && (
                                    <PartRowNew
                                      productId={productId}
                                      groupCode={g.code}
                                      sectionTitle={sec.title}
                                      unitBasis={sec.unitBasis}
                                      setItemLabel={sub.label}
                                      materialKind={sec.rows[0]?.material_kind ?? null}
                                      colSpanExtra={1}
                                    />
                                  )}
                                </Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}

                    {canEdit && !hasQuery && !inline && (
                      <button
                        type="button"
                        onClick={() => setEditing({ part: null, group: g.code })}
                        className="text-primary mt-2 text-xs font-medium hover:underline"
                      >
                        + Thêm dòng vào “{g.label}”
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Thêm KHỐI mới vào định mức đã có — dòng nhập chỉ nằm trong khối. */}
          {inline && !hasQuery && (
            <div className="px-5 py-3">
              {newSec ? (
                newSectionBlock
              ) : (
                <button
                  type="button"
                  onClick={openNewSection}
                  className="text-primary text-xs font-medium hover:underline"
                >
                  + Khối mới
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {bulk && (
        <PartsBulkEntry
          productId={productId}
          groups={partGroups}
          defaultGroup={firstGroup}
          onClose={() => setBulk(false)}
        />
      )}

      {copying && (
        <PartsCopyDialog
          productId={productId}
          hasParts={parts.length > 0}
          onClose={() => setCopying(false)}
        />
      )}

      {editing && (
        <PartLineEdit
          productId={productId}
          part={editing.part}
          defaultGroup={editing.group}
          groups={partGroups}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  )
}
