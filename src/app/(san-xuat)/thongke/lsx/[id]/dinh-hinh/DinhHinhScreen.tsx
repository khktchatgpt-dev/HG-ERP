'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, FileInput, Plus, Save, Trash2 } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/shadcn/button'
import { Checkbox } from '@/components/shadcn/checkbox'
import { Input } from '@/components/shadcn/input'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'

/**
 * BẢNG ĐỊNH HÌNH (dựng lại 27/08): nháp từ BOM / chép lệnh trước → sửa trên
 * lưới → Lưu (ghi đè trọn bộ, pattern BOM editor). Dòng CỤM từ BOM chuẩn mang
 * khoảng đếm sẵn; các trường không bày trên lưới (first/final stage, hệ số
 * cây, ĐM/cụm, vật tư) được GIỮ NGUYÊN qua state để lưu không rơi mất.
 */

type Draft = {
  key: string
  production_order_line_id: string
  kind: 'part' | 'assembly'
  cluster: string
  name: string
  group_code: string
  material_id: string | null
  material_type: string | null
  spec_thickness_mm: string
  spec_width_mm: string
  spec_length_mm: string
  wall_thickness_mm: string
  unit: string
  qty_per_unit: string
  dm_kg: string
  pcs_per_bar: number | null
  qty_per_assembly: number | null
  first_stage: string | null
  final_stage: string | null
  note: string
}

export type InitialRow = {
  production_order_line_id: string
  kind: 'part' | 'assembly'
  cluster: string | null
  name: string
  group_code: string | null
  material_id: string | null
  material_type: string | null
  spec_thickness_mm: number | null
  spec_width_mm: number | null
  spec_length_mm: number | null
  wall_thickness_mm: number | null
  unit: string | null
  qty_per_unit: number
  dm_kg: number | null
  pcs_per_bar: number | null
  qty_per_assembly: number | null
  first_stage: string | null
  final_stage: string | null
  note: string | null
}

/** Nhóm vật tư — quyết định lộ trình công đoạn (lib/stage-route). */
const GROUPS: { value: string; label: string }[] = [
  { value: '', label: '— nhóm? —' },
  { value: 'FRAME', label: 'Khung sắt/nhôm' },
  { value: 'WOOD', label: 'Gỗ' },
  { value: 'PANEL', label: 'Tấm' },
  { value: 'POLYWOOD', label: 'Polywood' },
  { value: 'CUSHION', label: 'Nệm' },
  { value: 'FABRIC', label: 'Vải' },
  { value: 'RATTAN', label: 'Mây/đan' },
  { value: 'PACKAGING', label: 'Bao bì' },
  { value: 'LABEL', label: 'Tem nhãn' },
  { value: 'NGU_KIM', label: 'Ngũ kim (mua)' },
]

let seq = 0
const key = () => `r${++seq}`
const s = (v: number | null | undefined) => (v == null ? '' : String(v))
const num = (v: string): number | null => {
  const t = v.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function toDraft(r: InitialRow): Draft {
  return {
    key: key(),
    production_order_line_id: r.production_order_line_id,
    kind: r.kind ?? 'part',
    cluster: r.cluster ?? '',
    name: r.name,
    group_code: r.group_code ?? '',
    material_id: r.material_id ?? null,
    material_type: r.material_type ?? null,
    spec_thickness_mm: s(r.spec_thickness_mm),
    spec_width_mm: s(r.spec_width_mm),
    spec_length_mm: s(r.spec_length_mm),
    wall_thickness_mm: s(r.wall_thickness_mm),
    unit: r.unit ?? '',
    qty_per_unit: s(r.qty_per_unit),
    dm_kg: s(r.dm_kg),
    pcs_per_bar: r.pcs_per_bar ?? null,
    qty_per_assembly: r.qty_per_assembly ?? null,
    first_stage: r.first_stage ?? null,
    final_stage: r.final_stage ?? null,
    note: r.note ?? '',
  }
}

const fmt = (n: number) => n.toLocaleString('vi-VN')

export function DinhHinhScreen({
  lsx,
  orderLines,
  initialRows,
  lockedByEntries,
  lsxClosed,
  canEdit,
}: {
  lsx: { id: string; code: string; customer_name: string }
  orderLines: {
    id: string
    product_code: string
    product_name: string
    qty: number
    group_title: string
  }[]
  initialRows: InitialRow[]
  lockedByEntries: boolean
  lsxClosed: boolean
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [rows, setRows] = useState<Draft[]>(() => initialRows.map(toDraft))
  const [seedProfile, setSeedProfile] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)

  const editable = canEdit && !lockedByEntries && !lsxClosed

  const patch = (k: string, p: Partial<Draft>) => {
    setRows((rs) => rs.map((r) => (r.key === k ? { ...r, ...p } : r)))
    setDirty(true)
  }
  const removeRow = (k: string) => {
    setRows((rs) => rs.filter((r) => r.key !== k))
    setDirty(true)
  }
  const addRow = (lineId: string) => {
    setRows((rs) => [
      ...rs,
      toDraft({
        production_order_line_id: lineId,
        kind: 'part',
        cluster: null,
        name: '',
        group_code: '',
        material_id: null,
        material_type: null,
        spec_thickness_mm: null,
        spec_width_mm: null,
        spec_length_mm: null,
        wall_thickness_mm: null,
        unit: 'cái',
        qty_per_unit: 1,
        dm_kg: null,
        pcs_per_bar: null,
        qty_per_assembly: null,
        first_stage: null,
        final_stage: null,
        note: null,
      }),
    ])
    setDirty(true)
  }

  async function suggest(source: 'bom' | 'previous') {
    if (busy) return
    setBusy(true)
    try {
      const { lines } = await api<{ lines: InitialRow[] }>(
        `/api/dept/production/lsx/${lsx.id}/components/suggest?source=${source}`,
      )
      if (lines.length === 0) {
        toast.warning(
          source === 'bom'
            ? 'Không có gì để nạp — các SP của lệnh chưa có định mức trong hồ sơ'
            : 'Không có lệnh trước nào chứa các SP này',
        )
        return
      }
      setRows(lines.map(toDraft))
      setDirty(true)
      toast.success(
        `Đã nạp ${lines.length} dòng${source === 'bom' ? ' từ BOM kỹ thuật' : ' từ lệnh trước'}`,
        'Đây là BẢN NHÁP trên màn — soát rồi bấm Lưu mới ghi vào lệnh',
      )
    } catch (e) {
      toast.error('Không nạp được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (busy) return
    const bad = rows.find((r) => !r.name.trim() || !((num(r.qty_per_unit) ?? 0) > 0))
    if (bad) {
      toast.error(
        'Bảng chưa hợp lệ',
        'Mỗi dòng phải có TÊN và CT/SP > 0 — xoá dòng thừa nếu không dùng',
      )
      return
    }
    setBusy(true)
    try {
      const res = await api<{
        seeded: { product_code: string; added: number }[]
        seed_skipped: { product_code: string; reason: string }[]
      }>(`/api/dept/production/lsx/${lsx.id}/components`, {
        method: 'PUT',
        body: {
          seed_profile: seedProfile,
          lines: rows.map((r) => ({
            production_order_line_id: r.production_order_line_id,
            kind: r.kind,
            cluster: r.cluster.trim() || null,
            name: r.name.trim(),
            group_code: r.group_code || null,
            material_id: r.material_id,
            material_type: r.material_type,
            spec_thickness_mm: num(r.spec_thickness_mm),
            spec_width_mm: num(r.spec_width_mm),
            spec_length_mm: num(r.spec_length_mm),
            wall_thickness_mm: num(r.wall_thickness_mm),
            unit: r.unit.trim() || null,
            qty_per_unit: num(r.qty_per_unit),
            dm_kg: num(r.dm_kg),
            pcs_per_bar: r.pcs_per_bar,
            qty_per_assembly: r.qty_per_assembly,
            first_stage: r.first_stage,
            final_stage: r.final_stage,
            note: r.note.trim() || null,
          })),
        },
      })
      const seededMsg = res.seeded.length
        ? ` · khởi tạo hồ sơ: ${res.seeded.map((x) => `${x.product_code} (+${x.added})`).join(', ')}`
        : ''
      toast.success(`Đã lưu bảng định hình ${fmt(rows.length)} dòng${seededMsg}`)
      if (res.seed_skipped.length) {
        toast.warning(
          'Một số SP không khởi tạo được hồ sơ',
          res.seed_skipped.map((x) => `${x.product_code}: ${x.reason}`).join(' · '),
        )
      }
      setDirty(false)
      router.refresh()
    } catch (e) {
      toast.error('Không lưu được bảng', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const byLine = useMemo(() => {
    const m = new Map<string, Draft[]>()
    for (const r of rows) {
      const arr = m.get(r.production_order_line_id) ?? []
      arr.push(r)
      m.set(r.production_order_line_id, arr)
    }
    return m
  }, [rows])

  const cell = 'h-7 px-1.5 text-xs'
  const cellNum = `${cell} t-data text-right`

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Thống kê xưởng', href: '/thongke' },
          { label: 'Tiến độ theo lệnh', href: '/thongke/lenh' },
          { label: lsx.code, href: `/thongke/lsx/${lsx.id}` },
          { label: 'Định hình' },
        ]}
        title={`Định hình chi tiết — ${lsx.code}`}
        description={lsx.customer_name}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/thongke/lsx/${lsx.id}`}>
              <ArrowLeft aria-hidden />
              Tiến độ lệnh
            </Link>
          </Button>
        }
      />

      {lockedByEntries && (
        <div className="rounded-lg border border-[var(--warn)]/40 bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-4 py-2.5 text-sm">
          Lệnh đã có sổ số liệu — bảng định hình chỉ còn để tra cứu. Thật sự cần sửa thì
          xoá hết phiếu của lệnh trước (tab Phiếu ở màn tiến độ).
        </div>
      )}
      {lsxClosed && (
        <div className="rounded-lg border px-4 py-2.5 text-sm">
          Lệnh đã kết thúc — bảng chỉ để tra cứu.
        </div>
      )}

      {editable && (
        <section className="bg-card flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => suggest('bom')}
          >
            <FileInput aria-hidden />
            Nạp từ BOM kỹ thuật
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => suggest('previous')}
          >
            <Copy aria-hidden />
            Chép từ lệnh trước
          </Button>
          <span className="grow" />
          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={seedProfile}
              onCheckedChange={(v) => setSeedProfile(v === true)}
            />
            Khởi tạo hồ sơ SP từ bảng này (chỉ SP <b>chưa có</b> định mức)
          </label>
          <Button size="sm" disabled={busy || rows.length === 0} onClick={save}>
            {busy ? <Spinner size={14} /> : <Save aria-hidden />}
            Lưu bảng định hình
          </Button>
        </section>
      )}

      {orderLines.length === 0 ? (
        <EmptyState
          icon="▦"
          title="Lệnh chưa có dòng sản phẩm"
          description="Soạn dòng lệnh trước rồi mới định hình chi tiết."
        />
      ) : (
        orderLines.map((line) => {
          const lineRows = byLine.get(line.id) ?? []
          return (
            <section key={line.id} className="bg-card overflow-hidden rounded-lg border">
              <div className="bg-muted/60 flex flex-wrap items-center gap-2 border-b px-4 py-2">
                <span className="t-data text-sm font-semibold">{line.product_code}</span>
                <span className="text-muted-foreground text-xs">{line.product_name}</span>
                {line.group_title && (
                  <span className="text-muted-foreground text-[11px]">
                    · {line.group_title}
                  </span>
                )}
                <span className="t-data text-muted-foreground ml-auto text-xs">
                  × {fmt(line.qty)} bộ · {lineRows.length} dòng
                </span>
              </div>
              {lineRows.length === 0 && !editable ? (
                <p className="text-muted-foreground px-4 py-3 text-xs">
                  Chưa định hình chi tiết cho SP này.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1080px] text-sm">
                    <thead>
                      <tr className="text-muted-foreground border-b text-left text-[10px] uppercase">
                        <th className="w-32 px-3 py-1.5">Cụm</th>
                        <th className="min-w-44 py-1.5 pr-1.5">Tên chi tiết *</th>
                        <th className="w-36 py-1.5 pr-1.5">Nhóm</th>
                        <th className="w-16 py-1.5 pr-1.5">ĐVT</th>
                        <th className="w-20 py-1.5 pr-1.5 text-right">CT/SP *</th>
                        <th className="w-20 py-1.5 pr-1.5 text-right">ĐM kg</th>
                        <th className="w-16 py-1.5 pr-1.5 text-right">Dày</th>
                        <th className="w-16 py-1.5 pr-1.5 text-right">Rộng</th>
                        <th className="w-20 py-1.5 pr-1.5 text-right">Dài cắt</th>
                        <th className="w-14 py-1.5 pr-1.5 text-right">δ</th>
                        <th className="min-w-28 py-1.5 pr-1.5">Ghi chú</th>
                        {editable && <th className="w-9 py-1.5 pr-3" />}
                      </tr>
                    </thead>
                    <tbody>
                      {lineRows.map((r) => (
                        <tr key={r.key} className="border-b last:border-b-0">
                          <td className="px-3 py-1">
                            <span className="flex items-center gap-1">
                              {r.kind === 'assembly' && <Badge tone="blue">CỤM</Badge>}
                              <Input
                                value={r.cluster}
                                disabled={!editable}
                                onChange={(e) =>
                                  patch(r.key, { cluster: e.target.value })
                                }
                                className={cell}
                                aria-label="Cụm"
                              />
                            </span>
                          </td>
                          <td className="py-1 pr-1.5">
                            <Input
                              value={r.name}
                              disabled={!editable}
                              onChange={(e) => patch(r.key, { name: e.target.value })}
                              className={cell}
                              aria-label="Tên chi tiết"
                            />
                          </td>
                          <td className="py-1 pr-1.5">
                            <select
                              value={r.group_code}
                              disabled={!editable}
                              onChange={(e) =>
                                patch(r.key, { group_code: e.target.value })
                              }
                              className={`border-input bg-card text-foreground w-full rounded-md border ${cell}`}
                              aria-label="Nhóm vật tư"
                            >
                              {GROUPS.map((g) => (
                                <option key={g.value} value={g.value}>
                                  {g.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1 pr-1.5">
                            <Input
                              value={r.unit}
                              disabled={!editable}
                              onChange={(e) => patch(r.key, { unit: e.target.value })}
                              className={cell}
                              aria-label="ĐVT"
                            />
                          </td>
                          <td className="py-1 pr-1.5">
                            <Input
                              value={r.qty_per_unit}
                              disabled={!editable}
                              onChange={(e) =>
                                patch(r.key, { qty_per_unit: e.target.value })
                              }
                              className={cellNum}
                              aria-label={`CT/SP ${r.name || 'dòng mới'}`}
                            />
                          </td>
                          <td className="py-1 pr-1.5">
                            <Input
                              value={r.dm_kg}
                              disabled={!editable}
                              onChange={(e) => patch(r.key, { dm_kg: e.target.value })}
                              className={cellNum}
                              aria-label="ĐM kg"
                            />
                          </td>
                          <td className="py-1 pr-1.5">
                            <Input
                              value={r.spec_thickness_mm}
                              disabled={!editable}
                              onChange={(e) =>
                                patch(r.key, { spec_thickness_mm: e.target.value })
                              }
                              className={cellNum}
                              aria-label="Dày"
                            />
                          </td>
                          <td className="py-1 pr-1.5">
                            <Input
                              value={r.spec_width_mm}
                              disabled={!editable}
                              onChange={(e) =>
                                patch(r.key, { spec_width_mm: e.target.value })
                              }
                              className={cellNum}
                              aria-label="Rộng"
                            />
                          </td>
                          <td className="py-1 pr-1.5">
                            <Input
                              value={r.spec_length_mm}
                              disabled={!editable}
                              onChange={(e) =>
                                patch(r.key, { spec_length_mm: e.target.value })
                              }
                              className={cellNum}
                              aria-label="Dài cắt"
                            />
                          </td>
                          <td className="py-1 pr-1.5">
                            <Input
                              value={r.wall_thickness_mm}
                              disabled={!editable}
                              onChange={(e) =>
                                patch(r.key, { wall_thickness_mm: e.target.value })
                              }
                              className={cellNum}
                              aria-label="Độ dày thành ống"
                            />
                          </td>
                          <td className="py-1 pr-1.5">
                            <Input
                              value={r.note}
                              disabled={!editable}
                              onChange={(e) => patch(r.key, { note: e.target.value })}
                              className={cell}
                              aria-label="Ghi chú"
                            />
                          </td>
                          {editable && (
                            <td className="py-1 pr-3 text-right">
                              <button
                                onClick={() => removeRow(r.key)}
                                className="text-muted-foreground hover:text-[var(--stop)]"
                                aria-label={`Xoá dòng ${r.name || 'mới'}`}
                              >
                                <Trash2 size={15} aria-hidden />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {editable && (
                <div className="border-t px-3 py-1.5">
                  <button
                    onClick={() => addRow(line.id)}
                    className="flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
                  >
                    <Plus size={14} aria-hidden />
                    Thêm dòng
                  </button>
                </div>
              )}
            </section>
          )
        })
      )}

      {editable && dirty && (
        <p className="text-muted-foreground text-xs">
          Bảng đang có thay đổi CHƯA LƯU — bấm “Lưu bảng định hình” để ghi vào lệnh.
        </p>
      )}
    </div>
  )
}
