'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/erp/Spinner'
import {
  MATERIAL_KIND_OPTIONS,
  SHAPE_OPTIONS,
  calcPartDerived,
  isCalculable,
} from '@/lib/bom-calc'
import { parseBomPaste, type DraftPart } from '@/lib/bom-paste'
import type { PartGroupView } from './ProductProfileCards'

const inp =
  'w-full rounded border border-zinc-300 px-1.5 py-1 text-xs focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'
const head =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

type Row = DraftPart & { key: number; material_kind: string | null }

const blank = (key: number): Row => ({
  key,
  part_no: null,
  cluster_name: null,
  part_name: '',
  profile_shape: null,
  material_kind: null,
  dim_a_mm: null,
  dim_b_mm: null,
  wall_thickness_mm: null,
  cut_length_mm: null,
  bend_waste_mm: null,
  tenon_mm: null,
  qty: null,
  unit: null,
  material_note: null,
  weight_kg: null,
  note: null,
})

const nOrNull = (v: string) => {
  const s = v.trim().replace(',', '.')
  if (!s) return null
  const x = Number(s)
  return Number.isFinite(x) ? x : null
}
const show = (v: number | null) => (v == null ? '' : String(v))

/**
 * Nhập NHIỀU dòng định mức một lượt — thay việc dựng định mức trên Excel.
 *
 * Khối / nhóm / đơn vị tính khai một lần ở đầu rồi áp cho cả lô, đúng cách biểu
 * mẫu BOM tổ chức. Có ô dán trực tiếp vùng copy từ Excel.
 */
export function PartsBulkEntry({
  productId,
  groups,
  defaultGroup,
  onClose,
}: {
  productId: string
  groups: PartGroupView[]
  defaultGroup: string
  onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const seq = useRef(1)
  const [group, setGroup] = useState(defaultGroup)
  const [sectionTitle, setSectionTitle] = useState('')
  const [unitBasis, setUnitBasis] = useState('')
  const [clusterName, setClusterName] = useState('')
  const [material, setMaterial] = useState('')
  const [rows, setRows] = useState<Row[]>(() => [blank(0)])
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [skipped, setSkipped] = useState<
    { line: number; text: string; reason: string }[]
  >([])
  /** Cột nào vừa nhận ra — bày lại để người dán kiểm trước khi lưu. */
  const [mapped, setMapped] = useState<{ index: number; label: string }[]>([])
  const [busy, setBusy] = useState(false)

  const patch = (key: number, p: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)))
  const addRow = () => setRows((rs) => [...rs, blank(seq.current++)])
  const dropRow = (key: number) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs))

  /** Vật liệu chọn ở đầu áp cho mọi dòng — cả lô thường cùng một vật liệu. */
  const derived = useMemo(
    () =>
      rows.map((r) =>
        calcPartDerived({
          profile_shape: r.profile_shape,
          material_kind: r.material_kind ?? material ?? null,
          dim_a_mm: r.dim_a_mm,
          dim_b_mm: r.dim_b_mm,
          wall_thickness_mm: r.wall_thickness_mm,
          cut_length_mm: r.cut_length_mm,
          qty: r.qty,
        }),
      ),
    [rows, material],
  )

  const valid = rows.filter((r) => r.part_name.trim() && (r.qty ?? 0) > 0)
  const totalKg = derived.reduce((s, d) => s + (d.weight_kg ?? 0), 0)

  function applyPaste() {
    const res = parseBomPaste(pasteText)
    if (res.rows.length === 0) {
      toast.error('Không đọc được dòng nào', 'Kiểm tra lại vùng đã copy')
      return
    }
    // Vùng dán không có cột hệ vật liệu (nhôm/sắt) — dùng ô "Vật liệu chung".
    setRows(res.rows.map((r) => ({ ...r, key: seq.current++, material_kind: null })))
    setSkipped(res.skipped)
    setMapped(res.mapped)
    setPasteOpen(false)
    setPasteText('')
    // Cụm đọc được từ vùng dán thì đừng để ô "Cụm chung" đè lên.
    if (res.rows.some((r) => r.cluster_name)) setClusterName('')
    toast.success(
      `Đã đọc ${res.rows.length} dòng`,
      res.source === 'header'
        ? 'Nhận cột theo tiêu đề của vùng dán'
        : 'Không có dòng tiêu đề — đoán cột theo vị trí, kiểm lại giúp',
    )
  }

  async function save() {
    if (valid.length === 0)
      return toast.error('Chưa có dòng nào hợp lệ', 'Cần tên chi tiết và số lượng > 0')
    setBusy(true)
    try {
      const r = await api<{ added: number }>(
        `/api/dept/technical/products/${productId}/parts/bulk`,
        {
          method: 'POST',
          body: {
            group_code: group,
            section_title: sectionTitle.trim() || null,
            unit_basis: unitBasis.trim() || null,
            lines: valid.map((r) => ({
              part_no: r.part_no,
              part_name: r.part_name.trim(),
              // Cụm ĐỌC ĐƯỢC TỪ VÙNG DÁN thắng ô khai chung: biểu mẫu mới ghi
              // cụm trên từng dòng, một lần dán có thể gồm nhiều cụm.
              cluster_name: r.cluster_name ?? clusterName.trim() ?? null,
              material_kind: r.material_kind ?? material ?? null,
              profile_shape: r.profile_shape,
              dim_a_mm: r.dim_a_mm,
              dim_b_mm: r.dim_b_mm,
              wall_thickness_mm: r.wall_thickness_mm,
              cut_length_mm: r.cut_length_mm,
              bend_waste_mm: r.bend_waste_mm,
              tenon_mm: r.tenon_mm,
              qty: r.qty,
              unit: r.unit,
              material_note: r.material_note,
              weight_kg: r.weight_kg,
              note: r.note,
            })),
          },
        },
      )
      router.refresh()
      toast.success(`Đã thêm ${r.added} dòng định mức`)
      onClose()
    } catch (err) {
      toast.error('Lưu thất bại', apiErrorText(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nhập nhiều dòng định mức"
      maxWidth="sm:max-w-6xl"
    >
      <div className="flex flex-col gap-3">
        {/* Khai một lần cho cả lô */}
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            Nhóm hạng mục
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className={head}
            >
              {groups.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Tiêu đề khối
            <input
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              className={head}
              placeholder="Quy cách : · Quy cách nệm: D23"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Vật liệu chung
            <select
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className={head}
            >
              <option value="">—</option>
              {MATERIAL_KIND_OPTIONS.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Cụm (Parts / Bộ phận) — áp cho cả lô
            <input
              value={clusterName}
              onChange={(e) => setClusterName(e.target.value)}
              className={head}
              placeholder="Cụm khung / Cụm mê"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Đơn vị tính của khối
            <input
              value={unitBasis}
              onChange={(e) => setUnitBasis(e.target.value)}
              className={head}
              placeholder="để trống = tính trên 1 SP"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => setPasteOpen((v) => !v)}
            className="text-primary font-medium hover:underline"
          >
            {pasteOpen ? 'Ẩn ô dán' : 'Dán từ Excel'}
          </button>
          <span className="text-muted-foreground">
            {valid.length}/{rows.length} dòng hợp lệ
            {totalKg > 0 && ` · tổng ${totalKg.toFixed(3)} kg`}
          </span>
        </div>

        {pasteOpen && (
          <div className="flex flex-col gap-2 rounded-md border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900 dark:bg-sky-950/30">
            <p className="text-muted-foreground text-xs">
              Copy vùng dòng chi tiết trong file BOM rồi dán vào đây. Nhận cả{' '}
              <b>biểu mẫu BOM đầy đủ</b> (Stt · Tên · Loại · Dày · Rộng · Dài · … · Dày
              vật liệu · Ghi chú) và <b>bảng gọn</b> (Tên · Loại · Dày · Rộng · Dày thành
              · Dài cắt · SL). Dòng tiêu đề và dòng “Tổng cộng” tự bỏ.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={5}
              className={`${head} font-mono text-xs`}
              placeholder={'Chân\tHộp\t18\t70\t1.4\t650\t4'}
            />
            <div>
              <button
                type="button"
                onClick={applyPaste}
                disabled={!pasteText.trim()}
                className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Đọc vào lưới
              </button>
            </div>
          </div>
        )}

        {/* Cột nào đã nhận ra — bày ra để soi trước khi lưu, vì đọc lệch một ô
            là toàn bộ quy cách sai mà nhìn bảng nháp rất khó thấy. */}
        {mapped.length > 0 && (
          <div className="text-muted-foreground flex flex-wrap items-center gap-1 rounded-md border p-2.5 text-xs">
            <span className="font-medium">Cột đã nhận:</span>
            {mapped.map((m) => (
              <span
                key={m.index}
                className="rounded bg-zinc-100 px-1.5 py-px tabular-nums dark:bg-zinc-800"
              >
                {m.index + 1}. {m.label}
              </span>
            ))}
          </div>
        )}

        {skipped.length > 0 && (
          <div className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Đã bỏ {skipped.length} dòng khi đọc:{' '}
            {skipped
              .slice(0, 4)
              .map((s) => `dòng ${s.line} (${s.reason})`)
              .join(', ')}
            {skipped.length > 4 && `, +${skipped.length - 4}`}
          </div>
        )}

        <div className="max-h-[45vh] overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-background sticky top-0">
              <tr className="text-muted-foreground border-b text-left uppercase">
                <th className="w-56 py-1.5 pr-2 font-medium">Tên chi tiết *</th>
                <th className="w-24 py-1.5 pr-2 font-medium">Dạng</th>
                <th className="w-16 py-1.5 pr-2 font-medium">Dày A</th>
                <th className="w-16 py-1.5 pr-2 font-medium">Rộng B</th>
                <th className="w-16 py-1.5 pr-2 font-medium">Dày thành</th>
                <th className="w-20 py-1.5 pr-2 font-medium">Dài cắt</th>
                <th className="w-16 py-1.5 pr-2 font-medium">SL *</th>
                <th className="w-16 py-1.5 pr-2 font-medium">ĐVT</th>
                <th className="w-24 py-1.5 pr-2 text-right font-medium">KL tính</th>
                <th className="py-1.5 pr-2 font-medium">Ghi chú</th>
                <th className="w-8 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const d = derived[i]
                const shapeOff = r.profile_shape && !isCalculable(r.profile_shape)
                return (
                  <tr key={r.key} className="border-b last:border-0">
                    <td className="py-1 pr-2">
                      <input
                        value={r.part_name}
                        onChange={(e) => patch(r.key, { part_name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && i === rows.length - 1) addRow()
                        }}
                        className={inp}
                        placeholder="Chân, Tay, Nan ngồi…"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <select
                        value={r.profile_shape ?? ''}
                        onChange={(e) =>
                          patch(r.key, { profile_shape: e.target.value || null })
                        }
                        className={inp}
                      >
                        <option value="">—</option>
                        {SHAPE_OPTIONS.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    {(
                      [
                        ['dim_a_mm', r.dim_a_mm],
                        ['dim_b_mm', r.dim_b_mm],
                        ['wall_thickness_mm', r.wall_thickness_mm],
                        ['cut_length_mm', r.cut_length_mm],
                        ['qty', r.qty],
                      ] as const
                    ).map(([field, val]) => (
                      <td key={field} className="py-1 pr-2">
                        <input
                          value={show(val)}
                          onChange={(e) =>
                            patch(r.key, { [field]: nOrNull(e.target.value) })
                          }
                          className={`${inp} text-right`}
                          inputMode="decimal"
                        />
                      </td>
                    ))}
                    <td className="py-1 pr-2">
                      <input
                        value={r.unit ?? ''}
                        onChange={(e) => patch(r.key, { unit: e.target.value || null })}
                        className={inp}
                      />
                    </td>
                    <td
                      className="text-muted-foreground py-1 pr-2 text-right tabular-nums"
                      title={
                        shapeOff
                          ? 'Dạng này có tiết diện tuỳ ý nên không tính được khối lượng'
                          : undefined
                      }
                    >
                      {d.weight_kg != null ? d.weight_kg.toFixed(3) : shapeOff ? '—' : ''}
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        value={r.note ?? ''}
                        onChange={(e) => patch(r.key, { note: e.target.value || null })}
                        className={inp}
                      />
                    </td>
                    <td className="py-1">
                      <button
                        type="button"
                        onClick={() => dropRow(r.key)}
                        title="Xoá dòng"
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

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={addRow}
            className="text-primary text-xs font-medium hover:underline"
          >
            + Thêm dòng (hoặc Enter ở dòng cuối)
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Huỷ
            </button>
            <button
              type="button"
              disabled={busy || valid.length === 0}
              onClick={() => void save()}
              className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-5 py-2 text-sm font-medium text-white shadow hover:bg-sky-700 disabled:opacity-50"
            >
              {busy && <Spinner size={14} />}
              {busy ? 'Đang lưu…' : `Lưu ${valid.length} dòng`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
